/**
 * Persistence Layer - Redis Storage
 *
 * Stores only stylized messages, sender roles, and timestamps.
 * Never stores original messages or raw Telegram payloads.
 *
 * Uses Redis for persistent storage in serverless environment.
 */

import { createClient } from 'redis';

const CONFIG_KEY = 'bot:config';
const MESSAGES_KEY = 'bot:messages';

// Connection status tracking
let isKVConnected = false;
let connectionChecked = false;
let redisClient = null;

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
 * Get or create Redis client
 */
async function getRedisClient() {
  if (!redisClient) {
    // Use REDIS_URL environment variable
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      try {
        redisClient = createClient({ url: redisUrl });
        await redisClient.connect();
        console.log('✓ Redis client connected');
      } catch (error) {
        console.error('Failed to connect to Redis:', error.message);
        redisClient = null;
      }
    }
  }
  return redisClient;
}

/**
 * Check if KV is properly configured and accessible
 */
async function checkKVConnection() {
  if (connectionChecked) {
    return isKVConnected;
  }

  try {
    const redis = await getRedisClient();

    if (!redis) {
      console.warn('Redis environment variable not set (REDIS_URL).');
      isKVConnected = false;
      connectionChecked = true;
      return false;
    }

    // Try a simple ping operation
    const result = await redis.ping();

    if (result === 'PONG') {
      isKVConnected = true;
      console.log('✓ Redis connection verified');
    } else {
      isKVConnected = false;
      console.warn('Redis health check failed: unexpected response');
    }
  } catch (error) {
    isKVConnected = false;
    console.warn('Redis connection check failed:', error.message);
    console.warn('Falling back to in-memory behavior for this session');
  }

  connectionChecked = true;
  return isKVConnected;
}

/**
 * Get KV connection status
 */
export function getKVConnectionStatus() {
  return {
    connected: isKVConnected,
    checked: connectionChecked,
    hasEnvVars: !!process.env.REDIS_URL,
    storageType: 'redis'
  };
}

/**
 * Initialize storage and verify KV connection
 */
export async function initializeStorage() {
  console.log('Initializing Redis storage...');
  await checkKVConnection();

  if (isKVConnected) {
    console.log('✓ Using Redis storage');
  } else {
    console.warn('⚠ Redis not connected - data will not persist across deployments');
  }

  return;
}

/**
 * Read configuration
 */
export async function readConfig() {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('Redis client not available, returning default config');
      return { ...DEFAULT_CONFIG };
    }
    const data = await redis.get(CONFIG_KEY);
    return data ? JSON.parse(data) : { ...DEFAULT_CONFIG };
  } catch (error) {
    console.error('Failed to read config from Redis:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Write configuration
 */
export async function writeConfig(config) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('Redis client not available, config not persisted');
      return;
    }
    await redis.set(CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to write config to Redis:', error);
    throw error;
  }
}

/**
 * Read messages
 */
export async function readMessages() {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('Redis client not available, returning default messages');
      return { ...DEFAULT_MESSAGES };
    }
    const data = await redis.get(MESSAGES_KEY);
    return data ? JSON.parse(data) : { ...DEFAULT_MESSAGES };
  } catch (error) {
    console.error('Failed to read messages from Redis:', error);
    return { ...DEFAULT_MESSAGES };
  }
}

/**
 * Write messages
 */
export async function writeMessages(messagesData) {
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.warn('Redis client not available, messages not persisted');
      return;
    }
    await redis.set(MESSAGES_KEY, JSON.stringify(messagesData));
  } catch (error) {
    console.error('Failed to write messages to Redis:', error);
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
  
  // Keep only last 100 messages to manage storage
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
