/**
 * LLM Service - Message Stylization using Google GenAI API
 * 
 * Uses Gemma model to rewrite messages in the selected style.
 * Returns only the stylized text, no explanations or metadata.
 */

import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { 
  createSimpleTrace
} from './opik.js';
import { 
  getStyleDescription,
  getLanguageName,
  generateBasePrompt,
  getAvailableStyles,
  getStylePresetDescription
 } from './prompts.js';
import { getPromptConfig, fetchRecentMessagesFromOpik } from './opik.js';
import { 
  shouldEvaluateAndImprove
} from './opik-feedback.js';

// Load environment variables
dotenv.config();

// Initialize GenAI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
 * Stylize a message using Gemma LLM
 * Uses stored improved prompts when available
 */
export async function stylizeMessage(originalMessage, style, customStyle = '', recipientLanguage = 'en', senderLanguage = 'en', userId = null, userRole = null, username = null, conversationId = null) {
  try {
    // Check for stored improved prompt first
    let promptTemplate = null;
    try {
      const promptConfig = await getPromptConfig(style, recipientLanguage);
      if (promptConfig && promptConfig.prompt) {
        promptTemplate = promptConfig.prompt;
        console.log(`Using stored improved prompt for ${style}/${recipientLanguage}`);
      }
    } catch (e) {
      // Storage not available, use default
    }
    
    // Fall back to base prompt if no stored improvement
    if (!promptTemplate) {
      promptTemplate = generateBasePrompt(style, customStyle, recipientLanguage);
    }
    
    // Replace {message} placeholder with actual message
    const prompt = promptTemplate.replace('{message}', originalMessage);

    const startTime = Date.now();
    const response = await ai.models.generateContent({
      model: 'gemma-3-27b-it',
      contents: prompt
    });
    const latency = Date.now() - startTime;
    
    let stylizedText = '';
    try {
      stylizedText = (response?.text || '').toString().trim();
    } catch (e) {
      console.error('Error extracting text from response:', e);
    }
    
    if (stylizedText) {
      stylizedText = stylizedText.replace(/^"[\s\S]*"|'[\s\S]*'|^[«»][\s\S]*[«»]$/g, '').trim();
    }
    
    const finalResult = (!stylizedText || stylizedText.length < 2) ? originalMessage : stylizedText;
    
    const trace = createSimpleTrace(
      'stylize_message',
      {
        original_message: originalMessage,
        style,
        custom_style: customStyle || null,
        language: senderLanguage,
        user_id: userId,
        username: username,
        user_role: userRole,
        conversation_id: conversationId,
        prompt: prompt,
      },
      {
        result: finalResult,
        language: recipientLanguage,
        success: stylizedText.length >= 2,
        model: 'gemma-3-27b-it',
        latency,
        fallback: stylizedText.length < 2,
      },
      { message_type: 'stylize', style }
    );
    
    // Check evaluation scores and improve prompt (async, runs in background)
    shouldEvaluateAndImprove(style, recipientLanguage).catch(err => {
      console.error('[Evaluation] Error:', err.message);
    });
    
    return { text: finalResult, trace, model: 'gemma-3-27b-it', latency };
    
  } catch (error) {
    console.error('Error stylizing message:', error);
    createSimpleTrace(
      'stylize_message',
      { original_message: originalMessage, style, custom_style: customStyle || null, language: senderLanguage, user_id: userId, username: username, error: error.message },
      { result: originalMessage, language: recipientLanguage, success: false, error: error.message, fallback: true },
      { message_type: 'stylize', style, error: true }
    );
    return { text: originalMessage, trace: null, model: null, latency: null };
  }
}

/**
 * Generate an icebreaker message based on conversation history from Opik traces
 */
export async function generateIcebreaker(recentMessages, style, customStyle = '', language = 'en') {
  try {
    // If no messages provided, fetch from Opik traces
    let messagesToUse = recentMessages;
    if (!recentMessages || recentMessages.length === 0) {
      messagesToUse = await fetchRecentMessagesFromOpik(20);
    }
    
    const styleDescription = getStyleDescription(style, customStyle);
    const languageName = getLanguageName(language);
    const languageInstruction = `Write the response EXCLUSIVELY in ${languageName} language.`;
    
    let context = '';
    if (messagesToUse && messagesToUse.length > 0) {
      context = 'Recent conversation context:\n';
      messagesToUse.slice(-10).forEach(msg => {
        context += `- ${msg.stylizedText}\n`;
      });
    } else {
      context = 'No previous conversation context.';
    }
    
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

    const startTime = Date.now();
    const response = await ai.models.generateContent({
      model: 'gemma-3-27b-it',
      contents: prompt
    });
    const latency = Date.now() - startTime;
    
    let icebreaker = response.text.trim();
    icebreaker = icebreaker.replace(/^"[\s\S]*"|'[\s\S]*'|^[«»][\s\S]*[«»]$/g, '').trim();
    
    const useFallback = !icebreaker || icebreaker.length < 5;
    if (useFallback) {
      icebreaker = FALLBACK_ICEBREAKERS[language] || FALLBACK_ICEBREAKERS.en;
    }
    
    const trace = createSimpleTrace(
      'generate_icebreaker',
      { style, custom_style: customStyle || null, language, message_count: recentMessages?.length || 0, context, prompt },
      { result: icebreaker, language, success: !useFallback, model: 'gemma-3-27b-it', latency, fallback: useFallback },
      { message_type: 'icebreaker', style }
    );
    
    return icebreaker;
    
  } catch (error) {
    console.error('Error generating icebreaker:', error);
    createSimpleTrace(
      'generate_icebreaker',
      { style, custom_style: customStyle || null, language, error: error.message },
      { result: FALLBACK_ICEBREAKERS[language] || FALLBACK_ICEBREAKERS.en, language, success: false, error: error.message, fallback: true },
      { message_type: 'icebreaker', style, error: true }
    );
    return FALLBACK_ICEBREAKERS[language] || FALLBACK_ICEBREAKERS.en;
  }
}

// Re-export functions from prompts.js for backward compatibility
export { getAvailableStyles, getStylePresetDescription };


