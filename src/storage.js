/**
 * Persistence Layer - File-based JSON storage with in-memory fallback
 * 
 * Stores only stylized messages, sender roles, and timestamps.
 * Never stores original messages or raw Telegram payloads.
 * 
 * Uses in-memory storage on Vercel (read-only filesystem).
 */

import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Detect if running on Vercel
const isVercel = process.env.VERCEL === '1';

// In-memory storage for Vercel
let inMemoryConfig = null;
let inMemoryMessages = null;

// Default configuration
const DEFAULT_CONFIG = {
  language: 'en', // UI language (en or ru)
  userA: {
    telegramId: null,
    username: null,
    language: 'auto', // Language for User A (auto = detect using LLM)
    customLanguage: '' // Custom language name if language is 'custom'
  },
  userB: {
    telegramId: null,
    username: null,
    language: 'auto', // Language for User B (auto = detect using LLM)
    customLanguage: '' // Custom language name if language is 'custom'
  },
  style: 'friendly',
  customStyle: '',
  icebreakerPeriodDays: 7,
  lastIcebreakerCheck: Date.now()
};

// Default messages storage
const DEFAULT_MESSAGES = {
  messages: [], // Array of { id, senderRole, stylizedText, timestamp }
  lastMessageTimestamp: null
};

/**
 * Initialize data directory and files
 */
export async function initializeStorage() {
  if (isVercel) {
    // Use in-memory storage on Vercel
    inMemoryConfig = { ...DEFAULT_CONFIG };
    inMemoryMessages = { ...DEFAULT_MESSAGES };
    console.log('Using in-memory storage (Vercel environment)');
    return;
  }

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Initialize config if not exists
    try {
      await fs.access(CONFIG_FILE);
    } catch {
      await fs.writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    }
    
    // Initialize messages if not exists
    try {
      await fs.access(MESSAGES_FILE);
    } catch {
      await fs.writeFile(MESSAGES_FILE, JSON.stringify(DEFAULT_MESSAGES, null, 2));
    }
    
  } catch (error) {
    console.error('Failed to initialize storage:', error);
    throw error;
  }
}

/**
 * Read configuration
 */
export async function readConfig() {
  if (isVercel) {
    return inMemoryConfig || { ...DEFAULT_CONFIG };
  }

  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read config:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Write configuration
 */
export async function writeConfig(config) {
  if (isVercel) {
    inMemoryConfig = config;
    return;
  }

  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Failed to write config:', error);
    throw error;
  }
}

/**
 * Read messages
 */
export async function readMessages() {
  if (isVercel) {
    return inMemoryMessages || { ...DEFAULT_MESSAGES };
  }

  try {
    const data = await fs.readFile(MESSAGES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read messages:', error);
    return { ...DEFAULT_MESSAGES };
  }
}

/**
 * Write messages
 */
export async function writeMessages(messagesData) {
  if (isVercel) {
    inMemoryMessages = messagesData;
    return;
  }

  try {
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messagesData, null, 2));
  } catch (error) {
    console.error('Failed to write messages:', error);
    throw error;
  }
}

/**
 * Add a stylized message to storage
 * Only stores the stylized version, never the original
 */
export async function addMessage(senderRole, stylizedText) {
  const messagesData = await readMessages();
  
  const message = {
    id: Date.now().toString(),
    senderRole, // 'A' or 'B'
    stylizedText,
    timestamp: Date.now()
  };
  
  messagesData.messages.push(message);
  messagesData.lastMessageTimestamp = message.timestamp;
  
  // Keep only last 100 messages to manage file size
  if (messagesData.messages.length > 100) {
    messagesData.messages = messagesData.messages.slice(-100);
  }
  
  await writeMessages(messagesData);
  
  return message;
}

/**
 * Get recent messages for icebreaker context
 * Returns only stylized messages
 */
export async function getRecentMessages(limit = 20) {
  const messagesData = await readMessages();
  return messagesData.messages.slice(-limit);
}

/**
 * Get last message timestamp
 */
export async function getLastMessageTimestamp() {
  const messagesData = await readMessages();
  return messagesData.lastMessageTimestamp;
}

/**
 * Update last icebreaker check time
 */
export async function updateLastIcebreakerCheck() {
  const config = await readConfig();
  config.lastIcebreakerCheck = Date.now();
  await writeConfig(config);
}

/**
 * Get time since last message in milliseconds
 */
export async function getTimeSinceLastMessage() {
  const lastTimestamp = await getLastMessageTimestamp();
  if (!lastTimestamp) return Infinity;
  return Date.now() - lastTimestamp;
}

/**
 * Get the role of the last sender ('A' or 'B')
 */
export async function getLastSenderRole() {
  const messagesData = await readMessages();
  if (messagesData.messages.length === 0) return null;
  return messagesData.messages[messagesData.messages.length - 1].senderRole;
}

/**
 * Clear all messages (for testing/reset)
 */
export async function clearMessages() {
  await writeMessages({ ...DEFAULT_MESSAGES });
}

/**
 * Reset configuration to defaults
 */
export async function resetConfig() {
  await writeConfig({ ...DEFAULT_CONFIG });
}
