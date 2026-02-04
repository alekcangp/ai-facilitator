/**
 * Feedback Utilities Module
 *
 * Shared utilities for feedback and prompt improvement functionality.
 * Consolidates duplicate code from opik-feedback.js and user-feedback.js.
 *
 * @module feedback-utils
 */

import { GoogleGenAI } from '@google/genai';

// ============================================================================
// CONFIGURATION
// ============================================================================

/** @type {number} Maximum number of prompt improvements per day */
export const MAX_IMPROVEMENTS_PER_DAY = 10;

/** @type {number} Score threshold below which evaluation metrics trigger improvements */
export const EVAL_THRESHOLD = 0.7;

// ============================================================================
// STATE
// ============================================================================

let improvements = { count: 0, date: null };

/**
 * Check if it's a new day and reset counter if so
 */
export function checkNewDay() {
  const today = new Date().toDateString();
  if (improvements.date !== today) {
    improvements = { count: 0, date: today };
  }
}

/**
 * Check if improvements can still be made today
 */
export function canImprove() {
  checkNewDay();
  return improvements.count < MAX_IMPROVEMENTS_PER_DAY;
}

/**
 * Record an improvement
 */
export function recordImprovement() {
  improvements.count++;
}

// ============================================================================
// LLM SETUP
// ============================================================================

let ai = null;

/**
 * Get or create the Google GenAI client
 */
export function getAI() {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

// ============================================================================
// IMPROVEMENT GENERATION
// ============================================================================

/**
 * Generate improvement suggestion based on feedback or evaluation metrics
 * 
 * @param {string} type - Type of input: 'feedback' or 'evaluation'
 * @param {string|Object} input - User feedback string OR evaluation object {metric, score}
 * @param {string} style - Current style being used
 * @param {string} language - Current language being used
 * @param {string} currentPrompt - The current prompt to improve
 * @returns {Promise<Object|null>} - Improvement object with issue and improvement, or null
 */
export async function generateImprovement(type, input, style, language, currentPrompt) {
  const gemini = getAI();
  if (!gemini) return null;

  let improvementPrompt;

  if (type === 'feedback') {
    improvementPrompt = `Analyze this user feedback and suggest how to improve the prompt.

USER FEEDBACK: "${input}"

CURRENT PROMPT:
${currentPrompt}

TASK: Improve the prompt to better address the user's feedback.
Respond with JSON:
{
  "issue": "Brief description of the issue",
  "improvement": "Specific improvement to add to the prompt"
}`;
  } else if (type === 'evaluation') {
    const { metric, score } = input;
    improvementPrompt = `Evaluation found low score for "${metric}" (${score.toFixed(2)} < ${EVAL_THRESHOLD}).

Style: ${style}
Language: ${language}

CURRENT PROMPT:
${currentPrompt}

TASK: Suggest how to improve the prompt to increase the "${metric}" score.
Respond with JSON:
{
  "issue": "What needs improvement",
  "improvement": "Specific change to make"
}`;
  } else {
    return null;
  }

  try {
    const response = await gemini.models.generateContent({
      model: 'gemma-3-27b-it',
      contents: improvementPrompt,
    });

    const result = response.text || '';
    const clean = result.replace(/```json?|```/g, '').trim();

    try {
      return JSON.parse(clean);
    } catch {
      return { issue: 'general', improvement: String(input) };
    }
  } catch (error) {
    console.error(`Error generating ${type} improvement:`, error);
    return null;
  }
}

// ============================================================================
// IMPROVEMENT APPLICATION
// ============================================================================

/**
 * Apply improvement section to a prompt
 * @param {string} prompt - The original prompt
 * @param {Object} improvement - The improvement object with issue and improvement properties
 * @param {string} source - Source of the improvement ('evaluation' or 'user')
 * @returns {string} - The updated prompt
 */
export function applyImprovement(prompt, improvement, source = 'general') {
  if (!improvement || !improvement.improvement) {
    return prompt;
  }

  const timestamp = new Date().toISOString();
  const section = `\n\n[IMPROVED ${timestamp}]
Based on ${source}: "${improvement.issue || 'general'}"
Action: ${improvement.improvement}
[/IMPROVED]
`;

  return prompt + section;
}
