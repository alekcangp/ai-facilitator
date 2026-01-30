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
 * @returns {Promise<string>} - The stylized message text only
 */
export async function stylizeMessage(originalMessage, style, customStyle = '') {
  try {
    const styleDescription = getStyleDescription(style, customStyle);
    
    // Create a prompt that ensures only the rewritten message is returned
    const prompt = `You are a message rewriter. Your task is to rewrite the given message in a ${styleDescription} style.

IMPORTANT RULES:
- Return ONLY the rewritten message, nothing else
- No explanations, no metadata, no quotes around the message
- Do not add emojis unless the style naturally includes them
- Keep the same core meaning and intent
- Make it sound natural and human

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
 * @returns {Promise<string>} - The icebreaker message
 */
export async function generateIcebreaker(recentMessages, style, customStyle = '') {
  try {
    const styleDescription = getStyleDescription(style, customStyle);
    
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
      icebreaker = 'Hey! How have you been?';
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
