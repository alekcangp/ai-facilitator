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

// Language names mapping for better instructions
const LANGUAGE_NAMES = {
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

// Fallback icebreaker messages by language
const FALLBACK_ICEBREAKERS = {
  en: 'Hey! How have you been?',
  ru: 'Привет! Как дела?',
  es: '¡Hola! ¿Cómo estás?',
  fr: 'Salut! Comment vas-tu?',
  de: 'Hallo! Wie geht es dir?',
  it: 'Ciao! Come stai?',
  pt: 'Olá! Como você está?',
  zh: '你好！最近怎么样？',
  ja: 'こんにちは！元気ですか？',
  ko: '안녕! 어떻게 지내?',
  ar: 'مرحبا! كيف حالك؟',
  nl: 'Hoi! Hoe gaat het?',
  pl: 'Cześć! Jak się masz?',
  tr: 'Merhaba! Nasılsın?',
  uk: 'Привіт! Як справи?',
  cs: 'Ahoj! Jak se máš?',
  sv: 'Hej! Hur är det?',
  da: 'Hej! Hvordan har du det?',
  no: 'Hei! Hvordan går det?',
  fi: 'Hei! Mitä kuuluu?'
};

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
 * Translate a message from one language to another without stylization
 *
 * @param {string} originalMessage - The original message text
 * @param {string} sourceLanguage - Source language code (e.g., 'en', 'ru', 'es', 'fr', etc.)
 * @param {string} targetLanguage - Target language code (e.g., 'en', 'ru', 'es', 'fr', etc.)
 * @returns {Promise<string>} - The translated message text only
 */
export async function translateMessage(originalMessage, sourceLanguage, targetLanguage) {
  try {
    const sourceLanguageName = LANGUAGE_NAMES[sourceLanguage] || sourceLanguage;
    const targetLanguageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

    // Create a prompt that ensures only the translated message is returned
    const prompt = `You are a professional translator. Your task is to translate the given message from ${sourceLanguageName} to ${targetLanguageName}.

IMPORTANT RULES:
- Return ONLY the translated message, nothing else
- No explanations, no metadata, no quotes around the message
- Keep the same core meaning and intent
- Make it sound natural and human

Original message: ${originalMessage}

Translated message:`;

    const response = await ai.models.generateContent({
      model: 'gemma-3-27b-it',
      contents: prompt
    });

    let translatedText = response.text.trim();

    // Remove any quotes if the model added them
    translatedText = translatedText.replace(/^["']|["']$/g, '');

    // If the result is empty or too short, return original
    if (!translatedText || translatedText.length < 2) {
      return originalMessage;
    }

    return translatedText;

  } catch (error) {
    console.error('Error translating message:', error);
    // On error, return original message to ensure delivery
    return originalMessage;
  }
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
    
    const languageName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;
    
    // Language-specific instructions
    const languageInstruction = `Write the response EXCLUSIVELY in ${languageName} language.`;
    
    // Create a prompt that ensures only the rewritten message is returned
    const prompt = `You are a message rewriter. Your task is to rewrite the given message in a ${styleDescription} style.

IMPORTANT RULES:
- Return ONLY the rewritten message, nothing else
- No explanations, no metadata, no quotes around the message
- Do not add emojis unless the style naturally includes them
- Keep the same core meaning and intent
- Make it sound natural and human
- Maintain approximately the same length as the original message (within 50% difference)
- Do not expand or condense the message significantly - keep it concise and similar in scope
- PRESERVE the original perspective (first person, second person, or third person) - do not change it
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
 * @param {string} language - Language to use (e.g., 'en', 'ru', 'es', 'fr', etc.)
 * @returns {Promise<string>} - The icebreaker message
 */
export async function generateIcebreaker(recentMessages, style, customStyle = '', language = 'en') {
  try {
    const styleDescription = getStyleDescription(style, customStyle);
    
    const languageName = LANGUAGE_NAMES[language] || language;
    
    // Language-specific instructions
    const languageInstruction = `Write the response EXCLUSIVELY in ${languageName} language.`;
    
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
- Keep it brief and concise (1-2 sentences, maximum 20 words)
- Make it feel human and genuine
- Write from FIRST PERSON perspective (use "I", "me", "my", "we", "us", "our") since this is a message from the sender
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
      icebreaker = FALLBACK_ICEBREAKERS[language] || FALLBACK_ICEBREAKERS.en;
    }
    
    return icebreaker;
    
  } catch (error) {
    console.error('Error generating icebreaker:', error);
    // Fallback icebreaker
    return FALLBACK_ICEBREAKERS[language] || FALLBACK_ICEBREAKERS.en;
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
