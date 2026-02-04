/**
 * Express Server - Web UI and API Endpoints
 * 
 * Provides a public configuration UI for the bot.
 * All settings managed through the UI - no external API endpoints exposed.
 */

import express from 'express';
import { initializeBot, setupBotHandlers, startBot, getBotInfo, sendToUser } from './bot.js';
import { getAvailableStyles } from './llm.js';
import { getNextIcebreakerDue, triggerScheduledIcebreaker, startLocalScheduler } from './icebreaker.js';
import { t } from './translations.js';
import {
  translateStyleName,
  translateLanguageName
} from './translations.js';
import { initializeOpik, readConfig, writeConfig, DEFAULT_CONFIG, fetchRecentMessagesFromOpik, deleteAllTraces, getPromptConfig, searchOpikTraces } from './opik.js';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Prevent caching of the main page
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '') {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// Track initialization state
let isInitialized = false;

// Initialize storage and bot
async function initialize() {
  if (isInitialized) {
    console.log('Already initialized, skipping...');
    return;
  }
  
  isInitialized = true;
  try {
    await initializeOpik();
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      console.warn('BOT_TOKEN not set. Bot will not start.');
      return;
    }
    
    const isVercel = process.env.VERCEL === '1';
    initializeBot(botToken, isVercel);
    
    if (!isVercel) {
      setupBotHandlers();
      startBot();
      const botInfo = await getBotInfo();
      console.log(`Bot started: @${botInfo.username}`);
      
      // Start local icebreaker scheduler (runs independently)
      startLocalScheduler(sendToUser, 3600000); // Check every hour
    } else {
      const botInfo = await getBotInfo();
      console.log(`Bot initialized: @${botInfo.username}`);
    }
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
}

// Replace template placeholders
function renderTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`__${key}__`, 'g'), value || '');
  }
  return result;
}

// Serve the main UI page
app.get('/', async (req, res) => {
  try {
    const config = await readConfig();
    const recentMessages = await fetchRecentMessagesFromOpik(5);
    const nextIcebreaker = await getNextIcebreakerDue();
    const botInfo = await getBotInfo();
    
    const lang = config.language || 'en';
    
    // Next icebreaker text
    let nextIcebreakerText = t(lang, 'noMessagesYet');
    if (nextIcebreaker) {
      const now = new Date();
      const diffDays = Math.ceil((nextIcebreaker - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) nextIcebreakerText = t(lang, 'dueNow');
      else nextIcebreakerText = `~${diffDays} ${t(lang, 'days')}`;
    }
    
    // Style options
    const styleOptionsHtml = getAvailableStyles().map(style => {
      const styleKey = 'style' + style.charAt(0).toUpperCase() + style.slice(1);
      const styleDescKey = styleKey + 'Desc';
      return '<option value="' + style + '"' + (config.style === style ? ' selected' : '') + '>' +
             t(lang, styleKey) + ' - ' + t(lang, styleDescKey) + '</option>';
    }).join('');
    
    // Recent messages (newest at bottom)
    const sortedMessages = [...recentMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const recentMessagesHtml = sortedMessages.length > 0 ? sortedMessages.map(msg =>
      '<div class="message-item"><div class="sender">' + (msg.username || (t(lang, 'user') + ' ' + msg.senderRole)) + '</div>' +
      '<div class="text">' + msg.stylizedText + '</div>' +
      '<div class="time">' + new Date(msg.timestamp).toLocaleString() + '</div></div>'
    ).join('') : '<p style="color: #999; font-style: italic;">' + t(lang, 'noMessages') + '</p>';
    
    // Load template
    const templatePath = path.join(process.cwd(), 'src', 'template.html');
    let template = await readFile(templatePath, 'utf-8');
    
    // Render template with all values
    const html = renderTemplate(template, {
      LANG: lang,
      LANG_EN_SELECTED: lang === 'en' ? 'selected' : '',
      LANG_RU_SELECTED: lang === 'ru' ? 'selected' : '',
      TITLE: t(lang, 'title'),
      SUBTITLE: t(lang, 'subtitle'),
      BOT_USERNAME: botInfo ? `<p style="margin-top: 10px; font-size: 12px;"><a href="https://t.me/${botInfo.username}" target="_blank" style="color: white; text-decoration: underline;">@${botInfo.username}</a></p>` : '',
      SETTINGS_SAVED: t(lang, 'settingsSaved'),
      CONNECTED_USERS: t(lang, 'connectedUsers'),
      USER_A: t(lang, 'userA'),
      USER_A_CLASS: config.userA.username ? '' : 'not-set',
      USER_A_NAME: config.userA.username || t(lang, 'notRegistered'),
      USER_A_LANGUAGE: config.userA.language ? `<p style="font-size: 12px; color: #666; margin-top: 5px;">${t(lang, 'languageLabel')} ${config.userA.language === 'auto' ? (config.userA.languageCode ? config.userA.languageCode.toUpperCase() : 'AUTO') : config.userA.language.toUpperCase()}</p>` : '',
      USER_B: t(lang, 'userB'),
      USER_B_CLASS: config.userB.username ? '' : 'not-set',
      USER_B_NAME: config.userB.username || t(lang, 'notRegistered'),
      USER_B_LANGUAGE: config.userB.language ? `<p style="font-size: 12px; color: #666; margin-top: 5px;">${t(lang, 'languageLabel')} ${config.userB.language === 'auto' ? (config.userB.languageCode ? config.userB.languageCode.toUpperCase() : 'AUTO') : config.userB.language.toUpperCase()}</p>` : '',
      NEXT_ICEBREAKER: t(lang, 'nextIcebreaker'),
      NEXT_ICEBREAKER_TEXT: nextIcebreakerText,
      SETTINGS: t(lang, 'settings'),
      MESSAGE_STYLE: t(lang, 'messageStyle'),
      STYLE_OPTIONS: styleOptionsHtml,
      CUSTOM: t(lang, 'custom'),
      CUSTOM_STYLE_SELECTED: config.style === 'custom' ? 'selected' : '',
      CUSTOM_STYLE_DISPLAY: config.style === 'custom' ? 'block' : 'none',
      CUSTOM_STYLE: t(lang, 'customStyle'),
      CUSTOM_STYLE_VALUE: config.customStyle,
      CUSTOM_STYLE_PLACEHOLDER: t(lang, 'customStylePlaceholder'),
      CUSTOM_STYLE_HELP: t(lang, 'customStyleHelp'),
      STYLIZATION_ENABLED: t(lang, 'stylizationEnabled'),
      STYLIZATION_CHECKED: config.stylizationEnabled !== false ? 'checked' : '',
      STYLIZATION_ENABLED_HELP: t(lang, 'stylizationEnabledHelp'),
      USER_A_LANGUAGE_LABEL: t(lang, 'userALanguage'),
      USER_A_LANG_AUTO: config.userA.language === 'auto' ? 'selected' : '',
      USER_A_LANG_EN: config.userA.language === 'en' ? 'selected' : '',
      USER_A_LANG_RU: config.userA.language === 'ru' ? 'selected' : '',
      USER_A_LANG_ES: config.userA.language === 'es' ? 'selected' : '',
      USER_A_LANG_FR: config.userA.language === 'fr' ? 'selected' : '',
      USER_A_LANG_DE: config.userA.language === 'de' ? 'selected' : '',
      USER_A_LANG_CUSTOM: config.userA.language === 'custom' ? 'selected' : '',
      AUTO: t(lang, 'auto'),
      ENGLISH: t(lang, 'english'),
      RUSSIAN: t(lang, 'russian'),
      USER_A_LANGUAGE_HELP: config.userA.language === 'auto' ? t(lang, 'autoDetectHelp') : (lang === 'ru' ? 'Язык для сообщений, отправляемых Пользователю A' : 'Language for messages sent to User A'),
      USER_A_CUSTOM_DISPLAY: config.userA.language === 'custom' ? 'block' : 'none',
      USER_A_CUSTOM_LANGUAGE: lang === 'ru' ? 'Кастомный язык для Пользователя A' : 'Custom Language for User A',
      USER_A_CUSTOM_VALUE: config.userA.customLanguage || '',
      USER_A_CUSTOM_PLACEHOLDER: lang === 'ru' ? 'например: Японский, Китайский, Итальянский' : 'e.g., Japanese, Chinese, Italian',
      USER_A_CUSTOM_HELP: lang === 'ru' ? 'Укажите название языка (например: Японский, Китайский, Итальянский)' : 'Specify the language name (e.g., Japanese, Chinese, Italian)',
      USER_B_LANGUAGE_LABEL: t(lang, 'userBLanguage'),
      USER_B_LANG_AUTO: config.userB.language === 'auto' ? 'selected' : '',
      USER_B_LANG_EN: config.userB.language === 'en' ? 'selected' : '',
      USER_B_LANG_RU: config.userB.language === 'ru' ? 'selected' : '',
      USER_B_LANG_ES: config.userB.language === 'es' ? 'selected' : '',
      USER_B_LANG_FR: config.userB.language === 'fr' ? 'selected' : '',
      USER_B_LANG_DE: config.userB.language === 'de' ? 'selected' : '',
      USER_B_LANG_CUSTOM: config.userB.language === 'custom' ? 'selected' : '',
      USER_B_LANGUAGE_HELP: config.userB.language === 'auto' ? t(lang, 'autoDetectHelp') : (lang === 'ru' ? 'Язык для сообщений, отправляемых Пользователю B' : 'Language for messages sent to User B'),
      USER_B_CUSTOM_DISPLAY: config.userB.language === 'custom' ? 'block' : 'none',
      USER_B_CUSTOM_LANGUAGE: lang === 'ru' ? 'Кастомный язык для Пользователя B' : 'Custom Language for User B',
      USER_B_CUSTOM_VALUE: config.userB.customLanguage || '',
      USER_B_CUSTOM_PLACEHOLDER: lang === 'ru' ? 'например: Японский, Китайский, Итальянский' : 'e.g., Japanese, Chinese, Italian',
      USER_B_CUSTOM_HELP: lang === 'ru' ? 'Укажите название языка (например: Японский, Китайский, Итальянский)' : 'Specify the language name (e.g., Japanese, Chinese, Italian)',
      ICEBREAKER_PERIOD: t(lang, 'icebreakerPeriod'),
      ICEBREAKER_PERIOD_VALUE: config.icebreakerPeriodDays,
      ICEBREAKER_PERIOD_HELP: t(lang, 'icebreakerPeriodHelp'),
      SAVE_SETTINGS: t(lang, 'saveSettings'),
      RECENT_MESSAGES: t(lang, 'recentMessages'),
      LAST_MESSAGES: t(lang, 'lastMessages'),
      RECENT_MESSAGES_HTML: recentMessagesHtml,
      RESET: t(lang, 'reset'),
      RESET_DESCRIPTION: t(lang, 'resetDescription'),
      RESET_CONFIG: t(lang, 'resetConfig'),
      FOOTER: t(lang, 'footer'),
      // Metrics translations
      EVALUATION_METRICS: t(lang, 'evaluationMetrics'),
      METRIC_COMPLETENESS: t(lang, 'metricCompleteness'),
      METRIC_PERSPECTIVE: t(lang, 'metricPerspective'),
      METRIC_CLARITY: t(lang, 'metricClarity'),
      METRIC_GRAMMAR: t(lang, 'metricGrammar'),
      METRIC_APPROPRIATENESS: t(lang, 'metricAppropriateness'),
      METRIC_NATURALNESS: t(lang, 'metricNaturalness'),
      FEEDBACK: t(lang, 'feedback'),
      LAST_FEEDBACK: t(lang, 'lastFeedback'),
      LOADING: t(lang, 'loading'),
      NO_EVALUATIONS: t(lang, 'noEvaluations'),
      NO_FEEDBACK: t(lang, 'noFeedback'),
    });
    
    res.send(html);
  } catch (error) {
    console.error('Error rendering page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Internal API: Update configuration
app.post('/api/config', async (req, res) => {
  try {
    const { style, customStyle, stylizationEnabled, userALanguage, userACustomLanguage, userBLanguage, userBCustomLanguage, icebreakerPeriodDays, language } = req.body;
    const config = await readConfig();

    if (style) config.style = style;
    if (customStyle !== undefined) config.customStyle = customStyle;
    if (stylizationEnabled !== undefined) config.stylizationEnabled = stylizationEnabled;
    if (userALanguage) { config.userA.language = userALanguage; config.userA.customLanguage = userACustomLanguage || ''; }
    if (userBLanguage) { config.userB.language = userBLanguage; config.userB.customLanguage = userBCustomLanguage || ''; }
    if (icebreakerPeriodDays) config.icebreakerPeriodDays = Math.max(3, Math.min(30, icebreakerPeriodDays));
    if (language && (language === 'en' || language === 'ru')) config.language = language;

    await writeConfig(config);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Internal API: Reset configuration
app.post('/api/config/reset', async (req, res) => {
  try {
    // Reset config to defaults
    await writeConfig(DEFAULT_CONFIG);
    
    // Delete all traces (except settings traces)
    const deleteResult = await deleteAllTraces();
    
    res.json({ 
      success: true, 
      message: 'Configuration reset and traces deleted',
      deletedTraces: deleteResult.deleted
    });
  } catch (error) {
    console.error('Error resetting config:', error);
    res.status(500).json({ error: 'Failed to reset configuration' });
  }
});

// Webhook endpoint for Telegram
app.post('/api/webhook', async (req, res) => {
  try {
    const botModule = await import('./bot.js');
    let message = req.body.message || req.body.edited_message || req.body.channel_post || req.body.edited_channel_post;
    if (message?.from) {
      await botModule.handleMessage(message);
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(200).send('Error');
  }
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/health/kv', async (req, res) => {
  try {
    const { getOpikClient } = await import('./opik.js');
    const client = getOpikClient();
    res.json({ status: client ? 'ok' : 'not_configured', storage: 'opik', connected: !!client, timestamp: Date.now() });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message, storage: 'opik' });
  }
});

// API: Fetch traces with evaluation metrics
app.get('/api/traces/evaluations', async (req, res) => {
  try {
    const traces = await searchOpikTraces(50);

    // Filter traces with message_type = 'stylize', sort by newest first, take last 10
    const styledTraces = traces
      .filter(t => t.metadata?.message_type === 'stylize')
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, 10)
      .map((t) => {
        // Extract scores from array format
        const scores = {};
        if (Array.isArray(t.feedbackScores)) {
          for (const item of t.feedbackScores) {
            if (item.name && typeof item.value === 'number') {
              scores[item.name.toLowerCase()] = item.value;
            }
          }
        }

        return {
          id: t.id,
          timestamp: t.startTime,
          style: t.metadata?.style || 'unknown',
          language: t.output?.language || 'unknown',
          originalMessage: t.input?.original_message || '',
          stylizedText: t.output?.result || '',
          feedbackScores: scores,
        };
      });

    // Calculate average scores
    const metrics = ['completeness', 'perspective', 'clarity', 'grammar', 'appropriateness', 'naturalness'];
    const totals = {};
    const counts = {};

    for (const metric of metrics) {
      totals[metric] = 0;
      counts[metric] = 0;
    }

    for (const trace of styledTraces) {
      const scores = trace.feedbackScores || {};
      for (const metric of metrics) {
        if (typeof scores[metric] === 'number') {
          totals[metric] += scores[metric];
          counts[metric]++;
        }
      }
    }

    const averages = {};
    for (const metric of metrics) {
      averages[metric] = counts[metric] > 0 ? totals[metric] / counts[metric] : null;
    }

    res.json({ traces: styledTraces, averages });
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Fetch user feedback from prompt configs
app.get('/api/feedback', async (req, res) => {
  try {
    // Get user's language preference for translations
    const config = await readConfig();
    const userLang = config.language || 'en';
    
    const allConfigs = await getPromptConfig();
    const feedback = [];
    
    for (const [style, languages] of Object.entries(allConfigs)) {
      for (const [language, config] of Object.entries(languages)) {
        if (config.comments && config.comments.length > 0) {
          for (const comment of config.comments.slice(-10)) {
            feedback.push({
              timestamp: comment.timestamp,
              style: translateStyleName(style, userLang),
              styleKey: style,
              language: translateLanguageName(language, userLang),
              languageCode: language,
              comment: comment.text,
            });
          }
        }
      }
    }
    
    // Sort by newest first and limit to 10
    feedback.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({ feedback: feedback.slice(0, 10) });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Scheduled icebreaker trigger (called by GitHub Actions cron)
// Uses random probability to trigger at random times throughout the day
app.post('/api/cron/icebreaker', async (req, res) => {
  try {
    // Random trigger: ~1/24 chance per hour (avg once per day)
    const triggerProbability = 1 / 24;
    const random = Math.random();
    
    console.log(`[CRON] Random check: ${random.toFixed(4)} vs ${triggerProbability.toFixed(4)}`);
    
    if (random > triggerProbability) {
      return res.json({ 
        success: true, 
        triggered: false, 
        reason: 'Random skip',
        nextAttempt: 'Next hour'
      });
    }
    
    // Check if icebreaker is due and send to both users
    await triggerScheduledIcebreaker(sendToUser);
    
    res.json({ 
      success: true, 
      sent: true,
      message: 'Icebreakers sent to both users'
    });
  } catch (error) {
    console.error('Error in scheduled icebreaker:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize and start server
initialize();
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Web UI: http://localhost:${PORT}`);
  });
}
export default app;
