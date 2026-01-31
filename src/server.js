/**
 * Express Server - Web UI and API Endpoints
 * 
 * Provides a public configuration UI for the bot.
 * No authentication required - simple and accessible.
 */

import express from 'express';
import { initializeBot, setupBotHandlers, startBot, getBotInfo } from './bot.js';
import { getAvailableStyles } from './llm.js';
import { getNextIcebreakerDue } from './icebreaker.js';
import { t } from './translations.js';
import dotenv from 'dotenv';

// Dynamic import for storage module based on environment
let initializeStorage, readConfig, writeConfig, resetConfig, getRecentMessages;
let getKVConnectionStatus = null;

async function loadStorageModule() {
  // Use JSON storage for local development, Redis for Vercel
  const isVercel = process.env.VERCEL === '1';
  const storageModule = await import(isVercel ? './storage-kv.js' : './storage.js');
  
  initializeStorage = storageModule.initializeStorage;
  readConfig = storageModule.readConfig;
  writeConfig = storageModule.writeConfig;
  resetConfig = storageModule.resetConfig;
  getRecentMessages = storageModule.getRecentMessages;
  
  if (storageModule.getKVConnectionStatus) {
    getKVConnectionStatus = storageModule.getKVConnectionStatus;
  }
}

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    // Load the appropriate storage module first
    await loadStorageModule();
    await initializeStorage();
    
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      console.warn('BOT_TOKEN not set. Bot will not start.');
      return;
    }
    
    // Detect if running on Vercel
    const isVercel = process.env.VERCEL === '1';
    
    // Initialize bot with appropriate mode
    initializeBot(botToken, isVercel);
    
    if (!isVercel) {
      // Local development: use polling
      setupBotHandlers();
      startBot();
      
      const botInfo = await getBotInfo();
      console.log(`Bot started: @${botInfo.username}`);
      console.log('Using polling mode (local development)');
    } else {
      // Vercel: use webhook
      const botInfo = await getBotInfo();
      console.log(`Bot initialized: @${botInfo.username}`);
      console.log('Using webhook mode (Vercel deployment)');
      console.log(`Webhook URL: ${process.env.VERCEL_URL}/api/webhook`);
    }
    
  } catch (error) {
    console.error('Failed to initialize:', error);
  }
}

// Serve the main UI page
app.get('/', async (req, res) => {
  try {
    const config = await readConfig();
    const recentMessages = await getRecentMessages(5);
    const nextIcebreaker = await getNextIcebreakerDue();
    const botInfo = await getBotInfo();
    
    // Get language from config (default to 'en')
    const lang = config.language || 'en';
    
    // Format next icebreaker time
    let nextIcebreakerText = t(lang, 'noMessagesYet');
    if (nextIcebreaker) {
      const now = new Date();
      const diffDays = Math.ceil((nextIcebreaker - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        nextIcebreakerText = t(lang, 'dueNow');
      } else {
        nextIcebreakerText = `~${diffDays} ${t(lang, 'days')}`;
      }
    }
    
    // Pre-generate style options HTML to avoid nested template literals
    const styleOptionsHtml = getAvailableStyles().map(style => {
      const styleKey = 'style' + style.charAt(0).toUpperCase() + style.slice(1);
      const styleDescKey = styleKey + 'Desc';
      return '<option value="' + style + '"' + (config.style === style ? ' selected' : '') + '>' +
             t(lang, styleKey) + ' - ' + t(lang, styleDescKey) +
             '</option>';
    }).join('');
    
    // Pre-generate recent messages HTML to avoid nested template literals
    const recentMessagesHtml = recentMessages.length > 0 ? recentMessages.map(msg => {
      return '<div class="message-item">' +
             '<div class="sender">' + t(lang, 'user') + ' ' + msg.senderRole + '</div>' +
             '<div class="text">' + msg.stylizedText + '</div>' +
             '<div class="time">' + new Date(msg.timestamp).toLocaleString() + '</div>' +
             '</div>';
    }).join('') : '<p style="color: #999; font-style: italic;">' + t(lang, 'noMessages') + '</p>';
    
    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Telegram Facilitator Bot</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 800px;
      margin: 20px 0;
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      position: relative;
    }
    
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    .header p {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .language-selector {
      position: absolute;
      top: 20px;
      right: 20px;
    }
    
    .language-selector select {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      backdrop-filter: blur(10px);
    }
    
    .language-selector select option {
      background: white;
      color: #333;
    }
    
    .content {
      padding: 30px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #f0f0f0;
    }
    
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .status-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    
    .status-card h3 {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    
    .status-card p {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    
    .status-card.not-set {
      border-left-color: #dc3545;
    }
    
    .status-card.not-set p {
      color: #dc3545;
    }
    
    .form-group {
      margin-bottom: 20px;
    }
    
    label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin-bottom: 8px;
    }
    
    select, input[type="text"], input[type="number"] {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.3s;
    }
    
    select:focus, input:focus {
      outline: none;
      border-color: #667eea;
    }
    
    .help-text {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    
    .btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }
    
    .btn:active {
      transform: translateY(0);
    }
    
    .btn-secondary {
      background: #6c757d;
    }
    
    .btn-secondary:hover {
      box-shadow: 0 5px 20px rgba(108, 117, 125, 0.4);
    }
    
    .message-preview {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin-top: 10px;
    }
    
    .message-preview h4 {
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
    }
    
    .message-item {
      background: white;
      padding: 10px;
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    
    .message-item .sender {
      font-weight: 600;
      color: #999;
      margin-bottom: 4px;
    }
    
    .message-item .text {
      color: #333;
      margin-bottom: 4px;
    }
    
    .message-item .time {
      font-size: 11px;
      color: #999;
    }
    
    #successMessage {
      background: #d4edda;
      color: #155724;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: none;
    }
    
    .footer {
      text-align: center;
      padding: 20px;
      background: #f8f9fa;
      color: #666;
      font-size: 12px;
    }
    
    @media (max-width: 600px) {
      .content {
        padding: 20px;
      }
      
      .status-grid {
        grid-template-columns: 1fr;
      }
      
      .language-selector {
        position: static;
        margin-bottom: 15px;
        text-align: center;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="language-selector">
        <select id="languageSelect" onchange="changeLanguage()">
          <option value="en" ${lang === 'en' ? 'selected' : ''}>English</option>
          <option value="ru" ${lang === 'ru' ? 'selected' : ''}>Русский</option>
        </select>
      </div>
      <h1>${t(lang, 'title')}</h1>
      <p>${t(lang, 'subtitle')}</p>
      ${botInfo ? `<p style="margin-top: 10px; font-size: 12px;"><a href="https://t.me/${botInfo.username}" target="_blank" style="color: white; text-decoration: underline;">@${botInfo.username}</a></p>` : ''}
    </div>
    
    <div class="content">
      <div id="successMessage">${t(lang, 'settingsSaved')}</div>
      
        <div class="section">
          <h2 class="section-title">${t(lang, 'connectedUsers')}</h2>
          <div class="status-grid">
            <div class="status-card ${config.userA.username ? '' : 'not-set'}">
              <h3>${t(lang, 'userA')}</h3>
              <p>${config.userA.username || t(lang, 'notRegistered')}</p>
              ${config.userA.languageCode ? `<p style="font-size: 12px; color: #666; margin-top: 5px;">${t(lang, 'languageLabel')} ${config.userA.languageCode.toUpperCase()}</p>` : ''}
            </div>
            <div class="status-card ${config.userB.username ? '' : 'not-set'}">
              <h3>${t(lang, 'userB')}</h3>
              <p>${config.userB.username || t(lang, 'notRegistered')}</p>
              ${config.userB.languageCode ? `<p style="font-size: 12px; color: #666; margin-top: 5px;">${t(lang, 'languageLabel')} ${config.userB.languageCode.toUpperCase()}</p>` : ''}
            </div>
            <div class="status-card">
              <h3>${t(lang, 'nextIcebreaker')}</h3>
              <p>${nextIcebreakerText}</p>
            </div>
          </div>
        </div>
      
      <div class="section">
        <h2 class="section-title">${t(lang, 'settings')}</h2>
        <form id="settingsForm">
          <div class="form-group">
            <label for="style">${t(lang, 'messageStyle')}</label>
            <select id="style" name="style" required>
              ${styleOptionsHtml}
              <option value="custom" ${config.style === 'custom' ? 'selected' : ''}>${t(lang, 'custom')}</option>
            </select>
          </div>
          
          <div class="form-group" id="customStyleGroup" style="display: ${config.style === 'custom' ? 'block' : 'none'};">
            <label for="customStyle">${t(lang, 'customStyle')}</label>
            <input type="text" id="customStyle" name="customStyle" 
                   value="${config.customStyle}" 
                   placeholder="${t(lang, 'customStylePlaceholder')}">
            <p class="help-text">${t(lang, 'customStyleHelp')}</p>
          </div>
          
          <div class="form-group">
            <label for="userALanguage">${t(lang, 'userALanguage')}</label>
            <select id="userALanguage" name="userALanguage" required onchange="toggleCustomLanguage('A')">
              <option value="auto" ${config.userA.language === 'auto' ? 'selected' : ''}>${t(lang, 'auto')}</option>
              <option value="en" ${config.userA.language === 'en' ? 'selected' : ''}>${t(lang, 'english')}</option>
              <option value="ru" ${config.userA.language === 'ru' ? 'selected' : ''}>${t(lang, 'russian')}</option>
              <option value="es" ${config.userA.language === 'es' ? 'selected' : ''}>Español</option>
              <option value="fr" ${config.userA.language === 'fr' ? 'selected' : ''}>Français</option>
              <option value="de" ${config.userA.language === 'de' ? 'selected' : ''}>Deutsch</option>
              <option value="custom" ${config.userA.language === 'custom' ? 'selected' : ''}>${t(lang, 'custom')}</option>
            </select>
            <p class="help-text">${config.userA.language === 'auto' ? t(lang, 'autoDetectHelp') : (lang === 'ru' ? 'Язык для сообщений, отправляемых Пользователю A' : 'Language for messages sent to User A')}</p>
          </div>
          
          <div class="form-group" id="userACustomLanguageGroup" style="display: ${config.userA.language === 'custom' ? 'block' : 'none'};">
            <label for="userACustomLanguage">${lang === 'ru' ? 'Кастомный язык для Пользователя A' : 'Custom Language for User A'}</label>
            <input type="text" id="userACustomLanguage" name="userACustomLanguage" 
                   value="${config.userA.customLanguage || ''}" 
                   placeholder="${lang === 'ru' ? 'например: Японский, Китайский, Итальянский' : 'e.g., Japanese, Chinese, Italian'}">
            <p class="help-text">${lang === 'ru' ? 'Укажите название языка (например: Японский, Китайский, Итальянский)' : 'Specify the language name (e.g., Japanese, Chinese, Italian)'}</p>
          </div>
          
          <div class="form-group">
            <label for="userBLanguage">${t(lang, 'userBLanguage')}</label>
            <select id="userBLanguage" name="userBLanguage" required onchange="toggleCustomLanguage('B')">
              <option value="auto" ${config.userB.language === 'auto' ? 'selected' : ''}>${t(lang, 'auto')}</option>
              <option value="en" ${config.userB.language === 'en' ? 'selected' : ''}>${t(lang, 'english')}</option>
              <option value="ru" ${config.userB.language === 'ru' ? 'selected' : ''}>${t(lang, 'russian')}</option>
              <option value="es" ${config.userB.language === 'es' ? 'selected' : ''}>Español</option>
              <option value="fr" ${config.userB.language === 'fr' ? 'selected' : ''}>Français</option>
              <option value="de" ${config.userB.language === 'de' ? 'selected' : ''}>Deutsch</option>
              <option value="custom" ${config.userB.language === 'custom' ? 'selected' : ''}>${t(lang, 'custom')}</option>
            </select>
            <p class="help-text">${config.userB.language === 'auto' ? t(lang, 'autoDetectHelp') : (lang === 'ru' ? 'Язык для сообщений, отправляемых Пользователю B' : 'Language for messages sent to User B')}</p>
          </div>
          
          <div class="form-group" id="userBCustomLanguageGroup" style="display: ${config.userB.language === 'custom' ? 'block' : 'none'};">
            <label for="userBCustomLanguage">${lang === 'ru' ? 'Кастомный язык для Пользователя B' : 'Custom Language for User B'}</label>
            <input type="text" id="userBCustomLanguage" name="userBCustomLanguage" 
                   value="${config.userB.customLanguage || ''}" 
                   placeholder="${lang === 'ru' ? 'например: Японский, Китайский, Итальянский' : 'e.g., Japanese, Chinese, Italian'}">
            <p class="help-text">${lang === 'ru' ? 'Укажите название языка (например: Японский, Китайский, Итальянский)' : 'Specify the language name (e.g., Japanese, Chinese, Italian)'}</p>
          </div>
          
          <div class="form-group">
            <label for="icebreakerPeriod">${t(lang, 'icebreakerPeriod')}</label>
            <input type="number" id="icebreakerPeriod" name="icebreakerPeriod" 
                   value="${config.icebreakerPeriodDays}" 
                   min="3" max="30" required>
            <p class="help-text">${t(lang, 'icebreakerPeriodHelp')}</p>
          </div>
          
          <button type="submit" class="btn">${t(lang, 'saveSettings')}</button>
        </form>
      </div>
      
      <div class="section">
        <h2 class="section-title">${t(lang, 'recentMessages')}</h2>
        <div class="message-preview">
          <h4>${t(lang, 'lastMessages')}</h4>
          ${recentMessagesHtml}
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">${t(lang, 'reset')}</h2>
        <form id="resetForm">
          <p style="margin-bottom: 15px; color: #666; font-size: 14px;">
            ${t(lang, 'resetDescription')}
          </p>
          <button type="submit" class="btn btn-secondary">${t(lang, 'resetConfig')}</button>
        </form>
      </div>
    </div>
    
    <div class="footer">
      <p>${t(lang, 'footer')}</p>
    </div>
  </div>
  
  <script>
    // Store translations for client-side use
    const translations = {
      autoDetectHelp: 'The bot will use the sender\\'s Telegram language setting',
      customLanguageHelp: 'Specify the language name (e.g., Japanese, Chinese, Italian)',
      languageHelp: 'Language for messages sent to User '
    };
    
    // Show/hide custom style input based on selection
    document.getElementById('style').addEventListener('change', function() {
      const customGroup = document.getElementById('customStyleGroup');
      customGroup.style.display = this.value === 'custom' ? 'block' : 'none';
    });
    
    // Show/hide custom language inputs based on selection
    function toggleCustomLanguage(user) {
      const select = document.getElementById('user' + user + 'Language');
      const customGroup = document.getElementById('user' + user + 'CustomLanguageGroup');
      const helpText = select.parentElement.querySelector('.help-text');
      
      // Show custom language input only when 'custom' is selected
      customGroup.style.display = select.value === 'custom' ? 'block' : 'none';
      
      // Update help text based on selection
      if (select.value === 'auto') {
        helpText.textContent = translations.autoDetectHelp;
      } else if (select.value === 'custom') {
        helpText.textContent = translations.customLanguageHelp;
      } else {
        helpText.textContent = translations.languageHelp + user;
      }
    }
    
    // Change language
    async function changeLanguage() {
      const lang = document.getElementById('languageSelect').value;
      try {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang })
        });

        if (response.ok) {
          location.reload();
        } else {
          alert('Failed to change language');
        }
      } catch (error) {
        alert('Error changing language: ' + error.message);
      }
    }
    
    // Handle settings form submission
    document.getElementById('settingsForm').addEventListener('submit', async function(e) {
      e.preventDefault();

      const formData = new FormData(this);
      const data = {
        style: formData.get('style'),
        customStyle: formData.get('customStyle') || '',
        userALanguage: formData.get('userALanguage'),
        userACustomLanguage: formData.get('userACustomLanguage') || '',
        userBLanguage: formData.get('userBLanguage'),
        userBCustomLanguage: formData.get('userBCustomLanguage') || '',
        icebreakerPeriodDays: parseInt(formData.get('icebreakerPeriod'))
      };

      try {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          document.getElementById('successMessage').style.display = 'block';
          setTimeout(() => {
            document.getElementById('successMessage').style.display = 'none';
          }, 3000);
        } else {
          alert('Failed to save settings');
        }
      } catch (error) {
        alert('Error saving settings: ' + error.message);
      }
    });
    
    // Handle reset
    document.getElementById('resetForm').addEventListener('submit', async function(e) {
      e.preventDefault();

      if (!confirm('Are you sure you want to reset all configuration and delete message history?')) {
        return;
      }

      try {
        const response = await fetch('/api/config/reset', {
          method: 'POST'
        });

        if (response.ok) {
          location.reload();
        } else {
          alert('Failed to reset configuration');
        }
      } catch (error) {
        alert('Error resetting configuration: ' + error.message);
      }
    });
  </script>
</body>
</html>`;
    
    res.send(html);
    
  } catch (error) {
    console.error('Error rendering page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// API: Get current configuration
app.get('/api/config', async (req, res) => {
  try {
    const config = await readConfig();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

// API: Update configuration
app.post('/api/config', async (req, res) => {
  try {
    const { style, customStyle, userALanguage, userACustomLanguage, userBLanguage, userBCustomLanguage, icebreakerPeriodDays, language } = req.body;

    const config = await readConfig();

    if (style) config.style = style;
    if (customStyle !== undefined) config.customStyle = customStyle;
    if (userALanguage) {
      config.userA.language = userALanguage;
      config.userA.customLanguage = userACustomLanguage || '';
    }
    if (userBLanguage) {
      config.userB.language = userBLanguage;
      config.userB.customLanguage = userBCustomLanguage || '';
    }
    if (icebreakerPeriodDays) {
      config.icebreakerPeriodDays = Math.max(3, Math.min(30, icebreakerPeriodDays));
    }
    if (language && (language === 'en' || language === 'ru')) {
      config.language = language;
    }

    await writeConfig(config);
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// API: Reset configuration
app.post('/api/config/reset', async (req, res) => {
  try {
    await resetConfig();
    res.json({ success: true });
  } catch (error) {
    console.error('Error resetting config:', error);
    res.status(500).json({ error: 'Failed to reset configuration' });
  }
});

// Webhook endpoint for Telegram (Vercel-compatible)
app.post('/api/webhook', async (req, res) => {
  try {
    const botModule = await import('./bot.js');
    
    // Extract the message from the Telegram update object
    // Telegram webhooks send updates with different types: message, edited_message, channel_post, etc.
    let message = null;
    
    if (req.body.message) {
      // Regular message
      message = req.body.message;
    } else if (req.body.edited_message) {
      // Edited message
      message = req.body.edited_message;
    } else if (req.body.channel_post) {
      // Channel post (may not have 'from' field)
      message = req.body.channel_post;
    } else if (req.body.edited_channel_post) {
      // Edited channel post (may not have 'from' field)
      message = req.body.edited_channel_post;
    } else {
      // Unsupported update type (callback_query, inline_query, etc.)
      // Still return 200 to avoid Telegram retries
      res.status(200).send('OK');
      return;
    }
    
    // Only process messages that have a 'from' field (required for user identification)
    if (!message.from) {
      res.status(200).send('OK');
      return;
    }
    
    // Pass the extracted message to handleMessage
    await botModule.handleMessage(message);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Redis health check endpoint
app.get('/health/kv', async (req, res) => {
  try {
    if (!getKVConnectionStatus) {
      return res.json({ 
        status: 'not_applicable', 
        message: 'Redis health check not available',
        storage: 'unknown'
      });
    }

    const kvStatus = getKVConnectionStatus();
    res.json({
      status: kvStatus.connected ? 'ok' : 'error',
      storage: 'redis',
      connected: kvStatus.connected,
      checked: kvStatus.checked,
      hasEnvVars: kvStatus.hasEnvVars,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error',
      message: error.message,
      storage: 'unknown'
    });
  }
});

// Initialize the application
initialize();

// Start server for local deployment (not Vercel)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Web UI: http://localhost:${PORT}`);
  });
}

// Export for Vercel
export default app;
