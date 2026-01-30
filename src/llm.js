/**
 * LLM Service - Message Stylization using Google GenAI API
 * 
 * Uses Gemma model to rewrite messages in the selected style.
 * Returns only the stylized text, no explanations or metadata.
 */

import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Load environment variables
dotenv.config();

// Initialize GenAI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Preset styles with their descriptions
const STYLE_PRESETS = {
  friendly: 'warm, casual, and conversational',
  formal: 'professional, polite, and respectful',
  playful: 'fun, lighthearted, and enthusiastic',
  romantic: 'affectionate, caring, and intimate',
  intellectual: 'thoughtful, analytical, and articulate',
  casual: 'relaxed, informal, and natural',
  poetic: 'expressive, metaphorical, and artistic'
};

/**
 * Detect the language of a message
 * Simple detection based on character sets
 * 
 * @param {string} text - The text to analyze
 * @returns {string} - Detected language ('en', 'ru', or 'en' as default)
 */
function detectLanguage(text) {
  // Check for Cyrillic characters (Russian)
  const cyrillicPattern = /[\u0400-\u04FF]/;
  if (cyrillicPattern.test(text)) {
    return 'ru';
  }
  // Default to English
  return 'en';
}

/**
 * Detect the language of a message using LLM
 * More sophisticated detection using AI
 * 
 * @param {string} text - The text to analyze
 * @returns {Promise<string>} - Detected language code ('en', 'ru', 'es', 'fr', 'de', etc.)
 */
export async function detectLanguageWithLLM(text) {
  try {
    // First, try simple detection for common languages (faster)
    const simpleDetection = detectLanguage(text);
    
    // If text is very short, use simple detection
    if (text.length < 20) {
      return simpleDetection;
    }
    
    // Use LLM for more accurate detection
    const prompt = `Analyze the following text and identify its primary language. 
Return ONLY the ISO 639-1 language code (2-letter code) in lowercase.
Common codes: en (English), ru (Russian), es (Spanish), fr (French), de (German), it (Italian), pt (Portuguese), zh (Chinese), ja (Japanese), ko (Korean), ar (Arabic).

Text: ${text}

Language code:`;

    const response = await ai.models.generateContent({
      model: 'gemma-3-27b-it',
      contents: prompt
    });
    
    let detectedLang = response.text.trim().toLowerCase();
    
    // Clean up the response (remove any extra text)
    detectedLang = detectedLang.replace(/[^a-z]/g, '').substring(0, 2);
    
    // Validate the detected language code
    const validCodes = ['en', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'nl', 'pl', 'tr', 'uk', 'cs', 'sv', 'da', 'no', 'fi'];
    
    if (validCodes.includes(detectedLang)) {
      return detectedLang;
    }
    
    // Fallback to simple detection
    return simpleDetection;
    
  } catch (error) {
    console.error('Error detecting language with LLM:', error);
    // Fallback to simple detection
    return detectLanguage(text);
  }
}

/**
 * Get the style description for a given style
 */
function getStyleDescription(style, customStyle) {
  if (style === 'custom' && customStyle) {
    return customStyle;
  }
  return STYLE_PRESETS[style] || STYLE_PRESETS.friendly;
}

/**
 * Stylize a message using Gemma LLM
 * 
 * @param {string} originalMessage - The original message text
 * @param {string} style - The style preset to use
 * @param {string} customStyle - Custom style description (if style is 'custom')
 * @param {string} targetLanguage - Target language for the response (e.g., 'en', 'ru', 'es', 'fr', etc.)
 * @returns {Promise<string>} - The stylized message text only
 */
export async function stylizeMessage(originalMessage, style, customStyle = '', targetLanguage = 'en') {
  try {
    const styleDescription = getStyleDescription(style, customStyle);
    
    // Language names mapping for better instructions
    const languageNames = {
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
    
    const languageName = languageNames[targetLanguage] || targetLanguage;
    
    // Language-specific instructions
    const languageInstruction = `Write the response in ${languageName} language.`;
    
    // Create a prompt that ensures only the rewritten message is returned
    const prompt = `You are a message rewriter. Your task is to rewrite the given message in a ${styleDescription} style.

IMPORTANT RULES:
- Return ONLY the rewritten message, nothing else
- No explanations, no metadata, no quotes around the message
- Do not add emojis unless the style naturally includes them
- Keep the same core meaning and intent
- Make it sound natural and human
- ${languageInstruction}

Original message: ${originalMessage}

Rewritten message:`;

    const response = await ai.models.generateContent({
      model: 'gemma-3-27b-it',
      contents: prompt
    });
    
    let stylizedText = response.text.trim();
    
    // Remove any quotes if the model added them
    stylizedText = stylizedText.replace(/^["']|["']$/g, '');
    
    // If the result is empty or too short, return original
    if (!stylizedText || stylizedText.length < 2) {
      return originalMessage;
    }
    
    return stylizedText;
    
  } catch (error) {
    console.error('Error stylizing message:', error);
    // On error, return original message to ensure delivery
    return originalMessage;
  }
}

/**
 * Generate an icebreaker message based on conversation history
 * 
 * @param {Array} recentMessages - Array of recent stylized messages
 * @param {string} style - The style preset to use
 * @param {string} customStyle - Custom style description (if style is 'custom')
 * @param {string} language - Language to use ('en' or 'ru')
 * @returns {Promise<string>} - The icebreaker message
 */
export async function generateIcebreaker(recentMessages, style, customStyle = '', language = 'en') {
  try {
    const styleDescription = getStyleDescription(style, customStyle);
    
    // Language-specific instructions
    const languageInstruction = language === 'ru' 
      ? 'Write the response in Russian language.' 
      : 'Write the response in English language.';
    
    // Build context from recent messages
    let context = '';
    if (recentMessages && recentMessages.length > 0) {
      context = 'Recent conversation context:\n';
      recentMessages.slice(-10).forEach(msg => {
        context += `- ${msg.stylizedText}\n`;
      });
    } else {
      context = 'No previous conversation context.';
    }
    
    // Create icebreaker prompt
    const prompt = `You are generating a natural conversation starter (icebreaker) for two people who haven't spoken in a while.

${context}

IMPORTANT RULES:
- Return ONLY the icebreaker message, nothing else
- No explanations, no metadata, no quotes
- Do NOT mention inactivity, time passed, or "it's been a while"
- Make it sound completely natural as if continuing a conversation
- Write in a ${styleDescription} style
- Keep it brief (1-2 sentences)
- Make it feel human and genuine
- ${languageInstruction}

Icebreaker message:`;

    const response = await ai.models.generateContent({
      model: 'gemma-3-27b-it',
      contents: prompt
    });
    
    let icebreaker = response.text.trim();
    
    // Remove any quotes if the model added them
    icebreaker = icebreaker.replace(/^["']|["']$/g, '');
    
    // Fallback if result is empty
    if (!icebreaker || icebreaker.length < 5) {
      icebreaker = language === 'ru' ? 'Привет! Как дела?' : 'Hey! How have you been?';
    }
    
    return icebreaker;
    
  } catch (error) {
    console.error('Error generating icebreaker:', error);
    // Fallback icebreaker
    return 'Hey! How have you been?';
  }
}

/**
 * Get list of available preset styles
 */
export function getAvailableStyles() {
  return Object.keys(STYLE_PRESETS);
}

/**
 * Get style description for a preset
 */
export function getStylePresetDescription(style) {
  return STYLE_PRESETS[style] || null;
}
