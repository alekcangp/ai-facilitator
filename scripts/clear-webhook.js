/**
 * Clear Telegram Webhook
 * 
 * Run this script to clear the webhook and enable polling mode.
 * Usage: npm run clear-webhook
 */

import https from 'https';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('Error: BOT_TOKEN environment variable is not set');
  console.error('Usage: BOT_TOKEN=your_token node scripts/clear-webhook.js');
  process.exit(1);
}

const url = `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`;

console.log('Clearing webhook...');

https.get(url, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    const response = JSON.parse(body);
    
    if (response.ok) {
      console.log('✓ Webhook cleared successfully!');
      console.log('  The bot can now use polling mode.');
      if (response.description) {
        console.log(`  Info: ${response.description}`);
      }
    } else {
      console.error('✗ Failed to clear webhook');
      console.error(`  Error: ${response.description}`);
      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.error('Error clearing webhook:', error);
  process.exit(1);
});
