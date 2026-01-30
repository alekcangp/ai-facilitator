/**
 * Setup Telegram Webhook
 * 
 * Run this script after deploying to Vercel to set up the webhook.
 * Usage: npm run set-webhook <your-vercel-url>
 */

import https from 'https';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.argv[2];

if (!BOT_TOKEN) {
  console.error('Error: BOT_TOKEN environment variable is not set');
  console.error('Usage: BOT_TOKEN=your_token node scripts/set-webhook.js <your-vercel-url>');
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error('Error: Vercel URL is not provided');
  console.error('Usage: BOT_TOKEN=your_token node scripts/set-webhook.js <your-vercel-url>');
  console.error('Example: BOT_TOKEN=your_token node scripts/set-webhook.js https://your-app.vercel.app');
  process.exit(1);
}

const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
const webhookUrl = `${WEBHOOK_URL}/api/webhook`;

console.log(`Setting webhook to: ${webhookUrl}`);

const data = JSON.stringify({ url: webhookUrl });

const options = {
  hostname: 'api.telegram.org',
  port: 443,
  path: `/bot${BOT_TOKEN}/setWebhook`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    const response = JSON.parse(body);
    
    if (response.ok) {
      console.log('✓ Webhook set successfully!');
      console.log(`  URL: ${webhookUrl}`);
      console.log(`  Info: ${response.description}`);
    } else {
      console.error('✗ Failed to set webhook');
      console.error(`  Error: ${response.description}`);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('Error setting webhook:', error);
  process.exit(1);
});

req.write(data);
req.end();
