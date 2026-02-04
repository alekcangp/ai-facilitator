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
import { getTraceId, createSimpleTrace } from './opik.js';
import { readConfig, writeConfig } from './opik.js';
import { processFeedbackComment } from './user-feedback.js';

// Bot instance (will be initialized)
let bot = null;
let isInitializing = false;

// Store last message trace info for feedback (userId -> trace info)
const lastMessageTraces = new Map();

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
      // Keep in-memory only, don't persist to Opik
      if (senderRole) {
        // Update languageCode only if language setting is 'auto'
        if (senderRole === 'A' && config.userA.language === 'auto') {
          config.userA.languageCode = msg.from.language_code || 'en';
        } else if (senderRole === 'B' && config.userB.language === 'auto') {
          config.userB.languageCode = msg.from.language_code || 'en';
        }

        await bot.sendMessage(
          telegramId,
          senderRole === 'A' ? t(lang, 'welcomeUserA') : t(lang, 'welcomeUserB')
        );
        return;
      }

      // If userA is not set, register as userA
      if (!config.userA.telegramId) {
        // Preserve existing language settings if configured via UI
        config.userA = {
          ...config.userA,
          telegramId,
          username,
          languageCode: msg.from.language_code || 'en'
        };
        await writeConfig(config);

        await bot.sendMessage(
          telegramId,
          t(lang, 'welcomeUserA')
        );
        return;
      }

      // If userB is not set, register as userB
      if (!config.userB.telegramId) {
        // Preserve existing language settings if configured via UI
        config.userB = {
          ...config.userB,
          telegramId,
          username,
          languageCode: msg.from.language_code || 'en'
        };
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

    // Handle /feedback command - Provide feedback on the last message
    // Format: /feedback <your comment>
    // Example: /feedback Add more warmth and emoji
    const feedbackCommand = messageText && messageText.toLowerCase().match(/^\/feedback\s+(.+)/i);
    
    if (feedbackCommand) {
      const senderRole = identifySender(telegramId, config);
      if (!senderRole) {
        await bot.sendMessage(
          telegramId,
          t(lang, 'notRegistered') || (lang === 'ru' ? 'Сначала зарегистрируйтесь!' : 'Please register first!')
        );
        return;
      }
      
      // Get the comment (everything after /feedback)
      const comment = feedbackCommand[1].trim();
      
      if (!comment) {
        await bot.sendMessage(
          telegramId,
          t(lang, 'feedbackUsage') || (lang === 'ru'
            ? 'Использование: /feedback <ваш комментарий>\n\nНапример: /feedback Добавь больше тепла и эмодзи'
            : 'Usage: /feedback <your comment>\n\nExample: /feedback Add more warmth and emoji')
        );
        return;
      }

      // Get last message trace info for this user
      const traceInfo = lastMessageTraces.get(telegramId);
      if (!traceInfo) {
        await bot.sendMessage(
          telegramId,
          t(lang, 'noMessageToRate') || (lang === 'ru'
            ? 'Нет сообщения для отзыва. Сначала получите стилизованное сообщение.'
            : 'No message to rate. First receive a stylized message.')
        );
        return;
      }

      // Store feedback and immediately process improvement
      try {
        // Process feedback and improve prompt immediately
        const improvementResult = await processFeedbackComment(
          comment,
          traceInfo.style,
          traceInfo.language
        );
        
        if (improvementResult && improvementResult.improved) {
          await bot.sendMessage(
            telegramId,
            t(lang, 'feedbackThanksImproved') || (lang === 'ru'
              ? `Спасибо за отзыв! Я улучшил стиль на основе вашего комментария: "${comment}"`
              : `Thank you for your feedback! I've improved the style based on your comment: "${comment}"`)
          );
        } else {
          await bot.sendMessage(
            telegramId,
            t(lang, 'feedbackThanks') || (lang === 'ru'
              ? `Спасибо за отзыв! Я учту ваш комментарий: "${comment}"`
              : `Thank you for your feedback! I'll consider your comment: "${comment}"`)
          );
        }
      } catch (error) {
        console.error('Error processing feedback:', error);
        await bot.sendMessage(
          telegramId,
          t(lang, 'feedbackError') || (lang === 'ru'
            ? 'Ошибка при обработке отзыва. Попробуйте позже.'
            : 'Error processing feedback. Please try again later.')
        );
      }

      // Clear the trace info after feedback
      lastMessageTraces.delete(telegramId);
      return;
    }

    // Handle /feedback command - Show last message and prompt for feedback
    if (messageText === '/feedback') {
      const senderRole = identifySender(telegramId, config);
      if (!senderRole) {
        await bot.sendMessage(
          telegramId,
          lang === 'ru' ? 'Сначала зарегистрируйтесь!' : 'Please register first!'
        );
        return;
      }

      const traceInfo = lastMessageTraces.get(telegramId);
      if (!traceInfo) {
        await bot.sendMessage(
          telegramId,
          lang === 'ru'
            ? 'Нет сообщения для отзыва'
            : 'No message to provide feedback on'
        );
        return;
      }

      const feedbackText = lang === 'ru'
        ? `Последнее сообщение:\n\n"${traceInfo.stylizedMessage}"\n\nОставьте отзыв:\n/feedback <ваш комментарий>\n\nНапример: /feedback Добавь больше тепла`
        : `Last message:\n\n"${traceInfo.stylizedMessage}"\n\nLeave feedback:\n/feedback <your comment>\n\nExample: /feedback Add more warmth`;

      await bot.sendMessage(telegramId, feedbackText);
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
        // Preserve existing language settings if configured via UI
        config.userA = {
          ...config.userA,
          telegramId,
          username,
          languageCode: msg.from.language_code || 'en'
        };
        await writeConfig(config);

        await bot.sendMessage(
          telegramId,
          t(lang, 'welcomeUserA')
        );
        return;
      }

      // If userB is not set, register as userB
      if (!config.userB.telegramId) {
        // Preserve existing language settings if configured via UI
        config.userB = {
          ...config.userB,
          telegramId,
          username,
          languageCode: msg.from.language_code || 'en'
        };
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
    // Keep in-memory only, don't persist to Opik on every message
    if (senderRole === 'A' && config.userA.language === 'auto') {
      config.userA.languageCode = msg.from.language_code || 'en';
    } else if (senderRole === 'B' && config.userB.language === 'auto') {
      config.userB.languageCode = msg.from.language_code || 'en';
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

    // Get sender's language
    let senderLanguage = senderRole === 'A'
      ? (config.userA.language || 'auto')
      : (config.userB.language || 'auto');

    // If language is 'auto', use the sender's Telegram language_code
    if (senderLanguage === 'auto') {
      senderLanguage = senderRole === 'A'
        ? (config.userA.languageCode || 'en')
        : (config.userB.languageCode || 'en');
      console.log(`Using sender's language_code for User ${senderRole}: ${senderLanguage}`);
    }

    // Determine if languages are the same
    const languagesAreSame = senderLanguage === recipientLanguage;

    // Process the message based on stylization setting
    let processedText;
    let traceInfo = null;
    const stylizationEnabled = config.stylizationEnabled !== false; // Default to true

    if (!stylizationEnabled && languagesAreSame) {
      // Stylization disabled and same language: forward original, but still trace for tracking
      processedText = messageText;
      const trace = createSimpleTrace(
        'stylize_message',
        {
          original_message: messageText,
          style: 'none',
          custom_style: null,
          language: senderLanguage,
          user_id: telegramId,
          username: username,
          user_role: senderRole,
          conversation_id: null,
          prompt: '[no stylization - original message]',
        },
        {
          result: messageText,
          language: recipientLanguage,
          success: true,
          model: 'none',
          latency: 0,
          fallback: false,
        },
        { message_type: 'stylize', style: 'none' }
      );
      traceInfo = {
        trace,
        model: null,
        latency: null
      };
      console.log(`Stylization disabled, same language: forwarding original message (traced)`);
    } else if (!stylizationEnabled && !languagesAreSame) {
      // Stylization disabled but different languages: stylize without style
      // Use 'neutral' style with just translation
      const result = await stylizeMessage(
        messageText,
        'neutral',  // Use neutral style for translation-only
        '',
        recipientLanguage,
        senderLanguage,
        telegramId,
        senderRole,
        username,
        null // conversationId
      );
      processedText = result.text;
      traceInfo = {
        trace: result.trace,
        model: result.model,
        latency: result.latency
      };
      console.log(`Stylization disabled, different languages: translating from ${senderLanguage} to ${recipientLanguage}`);
    } else {
      // Stylization enabled: use full stylization (includes translation if needed)
      // Uses ONE common prompt with style and language as parameters
      const result = await stylizeMessage(
        messageText,
        config.style,
        config.customStyle,
        recipientLanguage,  // Output language (recipient's)
        senderLanguage,      // Input language (sender's)
        telegramId,
        senderRole,
        username,
        null // conversationId
      );
      processedText = result.text;
      traceInfo = {
        trace: result.trace,
        model: result.model,
        latency: result.latency
      };
      console.log(`Stylization enabled: ${config.style} style in ${recipientLanguage}`);
    }

    // Messages stored in Opik traces, no local storage needed
    // Store trace info for feedback (for the recipient)
    const recipientTelegramId = getRecipientId(senderRole, config);
    if (recipientTelegramId && traceInfo.trace) {
      lastMessageTraces.set(recipientTelegramId, {
        messageId: traceInfo.trace.id,
        traceId: getTraceId(traceInfo.trace),
        trace: traceInfo.trace,
        originalMessage: messageText,
        stylizedMessage: processedText,
        style: config.style,
        language: recipientLanguage
      });
    }

    // Forward the processed message to the recipient
    await bot.sendMessage(recipientId, processedText);

    console.log(`Message from User ${senderRole} (${username}) -> User ${senderRole === 'A' ? 'B' : 'A'}`);
    console.log(`Original: ${messageText}`);
    console.log(`Processed: ${processedText}`);
    
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
