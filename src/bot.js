/**
 * Telegram Bot - Duplex Message Routing
 * 
 * Mediates messages between exactly two users (User A and User B).
 * Stylizes messages in both directions and forwards them naturally.
 */

import TelegramBot from 'node-telegram-bot-api';
import { stylizeMessage } from './llm.js';
import { triggerIcebreakerCheck } from './icebreaker.js';
import { t } from './translations.js';

// Dynamic import for storage module based on environment
let readConfig, writeConfig, addMessage, readMessages;

async function loadStorageModule() {
  // Use JSON storage for local development, Redis for Vercel
  const isVercel = process.env.VERCEL === '1';
  const storageModule = await import(isVercel ? './storage-kv.js' : './storage.js');

  readConfig = storageModule.readConfig;
  writeConfig = storageModule.writeConfig;
  addMessage = storageModule.addMessage;
  readMessages = storageModule.readMessages;
}

// Bot instance (will be initialized)
let bot = null;
let isInitializing = false;

/**
 * Initialize the Telegram bot
 * 
 * @param {string} token - Telegram bot token
 * @param {boolean} useWebhook - Whether to use webhook mode (for Vercel)
 * @returns {TelegramBot} - The bot instance
 */
export function initializeBot(token, useWebhook = false) {
  if (bot) {
    console.log('Bot already initialized, returning existing instance');
    return bot;
  }
  
  if (isInitializing) {
    console.warn('Bot initialization already in progress, please wait...');
    return null;
  }
  
  isInitializing = true;
  
  try {
    // Use webhook for Vercel, polling for local development
    // Don't auto-start polling - we'll start it explicitly
    bot = new TelegramBot(token, { polling: false });
    console.log(`Bot initialized with ${useWebhook ? 'webhook' : 'polling'} mode`);
    return bot;
  } finally {
    isInitializing = false;
  }
}

/**
 * Get the bot instance
 */
export function getBot() {
  return bot;
}

/**
 * Determine which user sent the message (A or B)
 * 
 * @param {number} telegramId - The Telegram user ID
 * @param {Object} config - The bot configuration
 * @returns {string|null} - 'A', 'B', or null if not recognized
 */
function identifySender(telegramId, config) {
  if (config.userA.telegramId === telegramId) {
    return 'A';
  }
  if (config.userB.telegramId === telegramId) {
    return 'B';
  }
  return null;
}

/**
 * Get the recipient's Telegram ID
 * 
 * @param {string} senderRole - 'A' or 'B'
 * @param {Object} config - The bot configuration
 * @returns {number|null} - Recipient's Telegram ID or null
 */
function getRecipientId(senderRole, config) {
  if (senderRole === 'A') {
    return config.userB.telegramId;
  }
  if (senderRole === 'B') {
    return config.userA.telegramId;
  }
  return null;
}

/**
 * Send a message to a specific user by role
 * 
 * @param {string} role - 'A' or 'B'
 * @param {string} text - Message text
 * @returns {Promise<boolean>} - True if sent successfully
 */
export async function sendToUser(role, text) {
  try {
    // Ensure storage module is loaded
    if (!readConfig) {
      await loadStorageModule();
    }
    
    const config = await readConfig();
    
    let telegramId;
    if (role === 'A') {
      telegramId = config.userA.telegramId;
    } else if (role === 'B') {
      telegramId = config.userB.telegramId;
    } else {
      return false;
    }
    
    if (!telegramId) {
      console.log(`User ${role} not configured yet`);
      return false;
    }
    
    await bot.sendMessage(telegramId, text);
    return true;
    
  } catch (error) {
    console.error(`Error sending message to User ${role}:`, error);
    return false;
  }
}

/**
 * Handle incoming message from Telegram
 *
 * @param {Object} msg - Telegram message object
 */
export async function handleMessage(msg) {
  try {
    // Ensure storage module is loaded
    if (!readConfig) {
      await loadStorageModule();
    }

    const config = await readConfig();

    // Get language from config (default to 'en')
    const lang = config.language || 'en';

    // Get sender info
    const telegramId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'Unknown';
    const messageText = msg.text;

    // Handle /start command explicitly
    if (messageText === '/start') {
      // Identify sender
      const senderRole = identifySender(telegramId, config);

      // If already registered, update their languageCode only if language is 'auto'
      if (senderRole) {
        // Update languageCode only if language setting is 'auto'
        if (senderRole === 'A' && config.userA.language === 'auto') {
          config.userA.languageCode = msg.from.language_code || 'en';
          await writeConfig(config);
        } else if (senderRole === 'B' && config.userB.language === 'auto') {
          config.userB.languageCode = msg.from.language_code || 'en';
          await writeConfig(config);
        }

        await bot.sendMessage(
          telegramId,
          senderRole === 'A' ? t(lang, 'welcomeUserA') : t(lang, 'welcomeUserB')
        );
        return;
      }

      // If userA is not set, register as userA
      if (!config.userA.telegramId) {
        config.userA.telegramId = telegramId;
        config.userA.username = username;
        config.userA.languageCode = msg.from.language_code || 'en';
        await writeConfig(config);

        await bot.sendMessage(
          telegramId,
          t(lang, 'welcomeUserA')
        );
        return;
      }

      // If userB is not set, register as userB
      if (!config.userB.telegramId) {
        config.userB.telegramId = telegramId;
        config.userB.username = username;
        config.userB.languageCode = msg.from.language_code || 'en';
        await writeConfig(config);

        await bot.sendMessage(
          telegramId,
          t(lang, 'welcomeUserB')
        );
        return;
      }

      // Both users are already registered
      await bot.sendMessage(
        telegramId,
        lang === 'ru' ? 'Вы уже зарегистрированы!' : 'You are already registered!'
      );
      return;
    }

    // Ignore non-text messages
    if (!messageText) {
      return;
    }

    // Identify sender
    const senderRole = identifySender(telegramId, config);

    // If sender is not recognized, check if we need to register them
    if (!senderRole) {
      // If userA is not set, register as userA
      if (!config.userA.telegramId) {
        config.userA.telegramId = telegramId;
        config.userA.username = username;
        config.userA.languageCode = msg.from.language_code || 'en';
        await writeConfig(config);

        await bot.sendMessage(
          telegramId,
          t(lang, 'welcomeUserA')
        );
        return;
      }

      // If userB is not set, register as userB
      if (!config.userB.telegramId) {
        config.userB.telegramId = telegramId;
        config.userB.username = username;
        config.userB.languageCode = msg.from.language_code || 'en';
        await writeConfig(config);

        await bot.sendMessage(
          telegramId,
          t(lang, 'welcomeUserB')
        );
        return;
      }

      // Both users are already registered, ignore this message
      return;
    }

    // Update sender's languageCode only if their language setting is 'auto'
    // Don't override if they've explicitly set a language via UI
    if (senderRole === 'A' && config.userA.language === 'auto') {
      config.userA.languageCode = msg.from.language_code || 'en';
      await writeConfig(config);
    } else if (senderRole === 'B' && config.userB.language === 'auto') {
      config.userB.languageCode = msg.from.language_code || 'en';
      await writeConfig(config);
    }
    
    // Get recipient ID
    const recipientId = getRecipientId(senderRole, config);
    
    if (!recipientId) {
      await bot.sendMessage(
        telegramId,
        t(lang, 'otherUserNotRegistered')
      );
      return;
    }
    
    // Get recipient's role and language
    const recipientRole = senderRole === 'A' ? 'B' : 'A';
    let recipientLanguage = recipientRole === 'A'
      ? (config.userA.language || 'auto')
      : (config.userB.language || 'auto');

    // If language is 'auto', use the recipient's Telegram language_code
    if (recipientLanguage === 'auto') {
      recipientLanguage = recipientRole === 'A'
        ? (config.userA.languageCode || 'en')
        : (config.userB.languageCode || 'en');
      console.log(`Using recipient's language_code for User ${recipientRole}: ${recipientLanguage}`);
    }
    
    // Stylize the message in recipient's language
    const stylizedText = await stylizeMessage(
      messageText,
      config.style,
      config.customStyle,
      recipientLanguage
    );
    
    // Store the stylized message (never the original)
    await addMessage(senderRole, stylizedText);
    
    // Forward the stylized message to the recipient
    await bot.sendMessage(recipientId, stylizedText);
    
    console.log(`Message from User ${senderRole} (${username}) -> User ${senderRole === 'A' ? 'B' : 'A'}`);
    console.log(`Original: ${messageText}`);
    console.log(`Stylized: ${stylizedText}`);
    
    // Check if icebreaker is due (lightweight check on each message)
    await triggerIcebreakerCheck(sendToUser);
    
  } catch (error) {
    console.error('Error handling message:', error);
  }
}

/**
 * Set up bot message handlers
 */
export function setupBotHandlers() {
  if (!bot) {
    throw new Error('Bot not initialized. Call initializeBot() first.');
  }
  
  // Handle text messages
  bot.on('message', handleMessage);
  
  // Handle polling errors
  bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
  });
}

/**
 * Start bot polling
 */
export function startBot() {
  if (!bot) {
    throw new Error('Bot not initialized. Call initializeBot() first.');
  }
  
  bot.startPolling();
  console.log('Bot polling started');
}

/**
 * Stop bot polling
 */
export function stopBot() {
  if (!bot) {
    return;
  }
  
  bot.stopPolling();
  console.log('Bot polling stopped');
}

/**
 * Get bot info
 */
export async function getBotInfo() {
  if (!bot) {
    return null;
  }
  
  try {
    return await bot.getMe();
  } catch (error) {
    console.error('Error getting bot info:', error);
    return null;
  }
}
