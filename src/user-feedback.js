/**
 * User Feedback Module
 * 
 * Handles user feedback via /feedback command.
 * Processes comments immediately and adapts prompts.
 */

import { getPromptConfig, updatePromptConfig } from './opik.js';
import { generateBasePrompt } from './prompts.js';
import { getAI, canImprove, recordImprovement, applyImprovement, generateImprovement } from './feedback-utils.js';

// ============================================================================
// COMMENT PROCESSING
// ============================================================================

/**
 * Process a single feedback comment and improve the prompt
 * 
 * @param {string} comment - User feedback comment
 * @param {string} style - Current style being used
 * @param {string} language - Current language being used
 * @returns {Promise<Object>} - Result with improved flag and details
 */
export async function processFeedbackComment(comment, style, language) {
  if (!canImprove()) {
    return { improved: false, reason: 'limit_reached' };
  }

  try {
    const config = await getPromptConfig(style, language);
    const currentPrompt = config.prompt || generateBasePrompt(style, '', language);

    // Use consolidated improvement generation
    const improvement = await generateImprovement('feedback', comment, style, language, currentPrompt);

    if (!improvement) {
      return { improved: false, reason: 'generation_failed' };
    }

    const improvedPrompt = applyImprovement(currentPrompt, improvement, 'user feedback');

    const comments = config.comments || [];
    comments.push({
      text: comment,
      improvement: improvement.improvement,
      timestamp: new Date().toISOString()
    });

    await updatePromptConfig(style, language, {
      prompt: improvedPrompt,
      comments: comments.slice(-50),
      lastImprovement: new Date().toISOString(),
      improvementCount: (config.improvementCount || 0) + 1,
    });

    recordImprovement();

    console.log(`Prompt improved for ${style}/${language}:`, improvement);
    return { improved: true, improvement };

  } catch (error) {
    console.error('Error processing feedback:', error);
    return { improved: false, reason: 'error', error: error.message };
  }
}
