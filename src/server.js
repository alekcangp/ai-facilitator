/**
 * Express Server - Web UI and API Endpoints
 * 
 * Provides a public configuration UI for the bot.
 * No authentication required - simple and accessible.
 */

import express from 'express';
import { initializeStorage, readConfig, writeConfig, resetConfig, getRecentMessages } from './storage.js';
import { initializeBot, setupBotHandlers, startBot, getBotInfo } from './bot.js';
import { getAvailableStyles, getStylePresetDescription } from './llm.js';
import { getNextIcebreakerDue } from './icebreaker.js';
import dotenv from 'dotenv';

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
    
    // Format next icebreaker time
    let nextIcebreakerText = 'No messages yet';
    if (nextIcebreaker) {
      const now = new Date();
      const diffDays = Math.ceil((nextIcebreaker - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        nextIcebreakerText = 'Due now';
      } else {
        nextIcebreakerText = `~${diffDays} days`;
      }
    }
    
    const html = `<!DOCTYPE html>
<html lang="en">
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
    }
    
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    .header p {
      font-size: 14px;
      opacity: 0.9;
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
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 Telegram Facilitator Bot</h1>
      <p>1-to-1 duplex messaging with AI stylization</p>
      ${botInfo ? `<p style="margin-top: 10px; font-size: 12px;">@${botInfo.username}</p>` : ''}
    </div>
    
    <div class="content">
      <div id="successMessage">✓ Settings saved successfully!</div>
      
      <div class="section">
        <h2 class="section-title">👥 Connected Users</h2>
        <div class="status-grid">
          <div class="status-card ${config.userA.username ? '' : 'not-set'}">
            <h3>User A</h3>
            <p>${config.userA.username || 'Not registered'}</p>
          </div>
          <div class="status-card ${config.userB.username ? '' : 'not-set'}">
            <h3>User B</h3>
            <p>${config.userB.username || 'Not registered'}</p>
          </div>
          <div class="status-card">
            <h3>Next Icebreaker</h3>
            <p>${nextIcebreakerText}</p>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">⚙️ Settings</h2>
        <form id="settingsForm">
          <div class="form-group">
            <label for="style">Message Style</label>
            <select id="style" name="style" required>
              ${getAvailableStyles().map(style => `
                <option value="${style}" ${config.style === style ? 'selected' : ''}>
                  ${style.charAt(0).toUpperCase() + style.slice(1)} - ${getStylePresetDescription(style)}
                </option>
              `).join('')}
              <option value="custom" ${config.style === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
          </div>
          
          <div class="form-group" id="customStyleGroup" style="display: ${config.style === 'custom' ? 'block' : 'none'};">
            <label for="customStyle">Custom Style Description</label>
            <input type="text" id="customStyle" name="customStyle" 
                   value="${config.customStyle}" 
                   placeholder="e.g., witty, sarcastic, philosophical">
            <p class="help-text">Describe how messages should be rewritten</p>
          </div>
          
          <div class="form-group">
            <label for="icebreakerPeriod">Icebreaker Period (days)</label>
            <input type="number" id="icebreakerPeriod" name="icebreakerPeriod" 
                   value="${config.icebreakerPeriodDays}" 
                   min="3" max="30" required>
            <p class="help-text">Random interval: ±2 days from this value (minimum 3 days)</p>
          </div>
          
          <button type="submit" class="btn">Save Settings</button>
        </form>
      </div>
      
      <div class="section">
        <h2 class="section-title">💬 Recent Messages</h2>
        <div class="message-preview">
          <h4>Last 5 stylized messages:</h4>
          ${recentMessages.length > 0 ? recentMessages.map(msg => `
            <div class="message-item">
              <div class="sender">User ${msg.senderRole}</div>
              <div class="text">${msg.stylizedText}</div>
              <div class="time">${new Date(msg.timestamp).toLocaleString()}</div>
            </div>
          `).join('') : '<p style="color: #999; font-style: italic;">No messages yet</p>'}
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">🔄 Reset</h2>
        <form id="resetForm">
          <p style="margin-bottom: 15px; color: #666; font-size: 14px;">
            Reset all settings to defaults. This will not delete message history.
          </p>
          <button type="submit" class="btn btn-secondary">Reset Configuration</button>
        </form>
      </div>
    </div>
    
    <div class="footer">
      <p>No original message inspection • Vercel-friendly</p>
    </div>
  </div>
  
  <script>
    // Show/hide custom style input based on selection
    document.getElementById('style').addEventListener('change', function() {
      const customGroup = document.getElementById('customStyleGroup');
      customGroup.style.display = this.value === 'custom' ? 'block' : 'none';
    });
    
    // Handle settings form submission
    document.getElementById('settingsForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const formData = new FormData(this);
      const data = {
        style: formData.get('style'),
        customStyle: formData.get('customStyle') || '',
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
      
      if (!confirm('Are you sure you want to reset all configuration?')) {
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
    const { style, customStyle, icebreakerPeriodDays } = req.body;
    
    const config = await readConfig();
    
    if (style) config.style = style;
    if (customStyle !== undefined) config.customStyle = customStyle;
    if (icebreakerPeriodDays) {
      config.icebreakerPeriodDays = Math.max(3, Math.min(30, icebreakerPeriodDays));
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
    const { handleMessage } = await import('./bot.js');
    await handleMessage(req.body);
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Web UI: http://localhost:${PORT}`);
  initialize();
});

export default app;
