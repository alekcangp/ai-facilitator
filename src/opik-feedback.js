/**
 * Opik Evaluation Module
 * 
 * Handles evaluation-based prompt improvements.
 * Fetches scores from Opik and improves prompts based on averages.
 */

import { getPromptConfig, updatePromptConfig, getOpikClient, searchOpikTraces } from './opik.js';
import { generateBasePrompt } from './prompts.js';
import { canImprove, recordImprovement, applyImprovement, generateImprovement, EVAL_THRESHOLD, MAX_IMPROVEMENTS_PER_DAY } from './feedback-utils.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCORE_CHECK_INTERVAL = 10; // Check every 10 messages

// ============================================================================
// STATE
// ============================================================================

let messageCount = 0;

// ============================================================================
// SCORE FETCHING
// ============================================================================

/**
 * Fetch last N traces and calculate average scores
 * Uses unified searchOpikTraces function
 * 
 * @param {string} style - Style to filter by
 * @param {string} language - Language to filter by
 * @param {number} limit - Max number of traces to fetch
 * @returns {Promise<Object|null>} - Average scores object or null
 */
async function fetchAndAverageScores(style, language, limit = 10) {
  if (!getOpikClient()) {
    console.log('[ScoreEval] Opik client not available');
    return null;
  }

  try {
    const traces = await searchOpikTraces(limit);
    console.log(`[ScoreEval] Fetched ${traces.length} traces`);

    // Filter locally by message_type, style AND output language
    const matchingTraces = traces.filter(trace => {
      const meta = trace.metadata || {};
      const out = trace.output || {};
      return meta.message_type === 'stylize' && meta.style === style && out.language === language;
    });

    console.log(`[ScoreEval] Filtered: ${matchingTraces.length} matching ${style}/${language}`);

    if (matchingTraces.length === 0) {
      return null;
    }

    // Calculate averages for all metrics
    const metrics = {};

    for (const trace of matchingTraces) {
      const scores = trace.feedbackScores || trace.feedbackScore || trace.feedback_scores;
      if (scores) {
        // feedbackScores is an array of {name, value} objects
        if (Array.isArray(scores)) {
          for (const score of scores) {
            if (typeof score.value === 'number' && score.name && !score.name.includes('_reason')) {
              if (!metrics[score.name]) {
                metrics[score.name] = { total: 0, count: 0 };
              }
              metrics[score.name].total += score.value;
              metrics[score.name].count++;
            }
          }
        } else if (typeof scores === 'object') {
          // Object format (legacy)
          for (const [metric, value] of Object.entries(scores)) {
            if (typeof value === 'number' && !metric.includes('_reason')) {
              if (!metrics[metric]) {
                metrics[metric] = { total: 0, count: 0 };
              }
              metrics[metric].total += value;
              metrics[metric].count++;
            }
          }
        }
      }
    }

    const averages = {};
    for (const [metric, data] of Object.entries(metrics)) {
      averages[metric] = data.total / data.count;
    }

    console.log(`[ScoreEval] ${matchingTraces.length} traces, averages:`, averages);
    return averages;

  } catch (error) {
    console.error('[ScoreEval] Error:', error.message);
    return null;
  }
}

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Check if it's time to evaluate AND run evaluation if needed
 * Called after every stylizeMessage
 * Improves ALL metrics below threshold, not just the worst one
 * 
 * @param {string} style - Current style being used
 * @param {string} language - Current language being used
 */
export async function shouldEvaluateAndImprove(style, language) {
  messageCount++;
  const isTime = messageCount % SCORE_CHECK_INTERVAL === 0;
  console.log(`[ScoreEval] Message ${messageCount}${isTime ? ' - EVALUATING' : ''}`);

  if (!isTime) return;
  if (!canImprove()) {
    console.log('[ScoreEval] Limit reached');
    return;
  }

  const averages = await fetchAndAverageScores(style, language);
  if (!averages) return;

  // Find ALL metrics below threshold
  const lowMetrics = [];
  for (const [metric, score] of Object.entries(averages)) {
    if (score < EVAL_THRESHOLD) {
      lowMetrics.push({ metric, score });
    }
  }

  if (lowMetrics.length === 0) {
    console.log(`[ScoreEval] All scores above threshold (${EVAL_THRESHOLD})`);
    return;
  }

  console.log(`[ScoreEval] Low metrics:`, lowMetrics.map(m => `${m.metric}=${m.score.toFixed(2)}`));

  // Get current prompt
  const config = await getPromptConfig(style, language);
  let currentPrompt = config.prompt || generateBasePrompt(style, '', language);

  // Generate and apply improvement for EACH low-scoring metric using consolidated function
  for (const { metric, score } of lowMetrics) {
    if (!canImprove()) {
      console.log('[ScoreEval] Limit reached during improvement');
      break;
    }

    // Use consolidated improvement generation
    const improvement = await generateImprovement('evaluation', { metric, score }, style, language, currentPrompt);

    if (!improvement) continue;

    currentPrompt = applyImprovement(currentPrompt, {
      issue: `[AvgEval ${metric}: ${score.toFixed(2)}]`,
      improvement: improvement.improvement
    }, 'evaluation');

    recordImprovement();
    console.log(`[ScoreEval] Improved ${metric}: ${score.toFixed(2)}`);
  }

  // Save updated prompt with all improvements
  await updatePromptConfig(style, language, {
    prompt: currentPrompt,
    lastImprovement: new Date().toISOString(),
    improvementCount: (config.improvementCount || 0) + lowMetrics.length,
    lastEvaluationScores: averages,
  });

  console.log(`[ScoreEval] Saved ${lowMetrics.length} improvements for ${style}/${language}`);
}

/**
 * Get feedback loop status for UI
 * 
 * @returns {Object} - Status object with adjustment info
 */
export function getFeedbackLoopStatus() {
  return {
    userAdjustments: 0, // opik-feedback doesn't track improvements separately
    maxUserAdjustmentsPerDay: MAX_IMPROVEMENTS_PER_DAY,
  };
}
