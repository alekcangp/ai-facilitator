/**
 * Centralized Prompt Module
 * 
 * Single source of truth for:
 * - Base prompt template
 * - Style descriptions
 * - Language names
 * - Prompt generation utilities
 */

// Preset styles with their descriptions
export const STYLE_PRESETS = {
  friendly: 'warm, casual, and conversational',
  formal: 'professional, polite, and respectful',
  playful: 'fun, lighthearted, and enthusiastic',
  romantic: 'affectionate, caring, and intimate',
  intellectual: 'thoughtful, analytical, and articulate',
  casual: 'relaxed, informal, and natural',
  poetic: 'expressive, metaphorical, and artistic'
};

// Language names mapping for better instructions
export const LANGUAGE_NAMES = {
  en: 'English',
  ru: 'Russian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  uk: 'Ukrainian',
  cs: 'Czech',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish'
};

/**
 * Get the style description for a given style
 * @param {string} style - Style key
 * @param {string} customStyle - Custom style description
 * @returns {string} - Style description
 */
export function getStyleDescription(style, customStyle = '') {
  if (style === 'custom' && customStyle) {
    return customStyle;
  }
  return STYLE_PRESETS[style] || 'natural and clear';
}

/**
 * Get language name for a given language code
 * @param {string} language - Language code
 * @returns {string} - Language name
 */
export function getLanguageName(language) {
  return LANGUAGE_NAMES[language] || language;
}

/**
 * Generate the base prompt for message rewriting
 * @param {string} style - Style key
 * @param {string} customStyle - Custom style description
 * @param {string} language - Language code
 * @returns {string} - Complete base prompt
 */
export function generateBasePrompt(style, customStyle = '', language = 'en') {
  const styleDescription = getStyleDescription(style, customStyle);
  const languageName = getLanguageName(language);
  const languageInstruction = `Write the response EXCLUSIVELY in ${languageName} language.`;

  return `You are a message rewriter. Your task is to rewrite the given message in a ${styleDescription} style.

IMPORTANT RULES:
- Return ONLY the rewritten message, nothing else
- No explanations, no metadata, no quotes around the message
- For SHORT MESSAGES like greetings (Привет, Hello, etc.), simply return the greeting in the requested style
- Make it sound natural and human
- Do not add emojis unless the style naturally includes them
- Keep the same core meaning and intent
- Maintain approximately the same length as the original message (within 50% difference)
- Do not expand or condense the message significantly - keep it concise and similar in scope

CRITICAL - PERSPECTIVE PRESERVATION:
- If original message uses FIRST PERSON (I, me, my, mine), keep first person
- If original message uses SECOND PERSON (you, your, yours), keep second person  
- If original message uses THIRD PERSON (he, she, they, his, her, their), keep third person
- The rewritten message must answer LIKE THE SENDER - it should sound like it comes FROM them, not addressed TO them
- NEVER change "I" to "you" or "you" to "I" or "yours" to "my" etc.
- NEVER change the perspective of the original message

${languageInstruction}

Original message: {message}

Rewritten message:`;
}

/**
 * Get list of available preset styles
 * @returns {string[]} - Array of style keys
 */
export function getAvailableStyles() {
  return Object.keys(STYLE_PRESETS);
}

/**
 * Get style description for a preset
 * @param {string} style - Style key
 * @returns {string|null} - Style description or null if not found
 */
export function getStylePresetDescription(style) {
  return STYLE_PRESETS[style] || null;
}
