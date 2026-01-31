# Telegram Facilitator Bot

A 1-to-1 duplex Telegram bot that mediates messages between two users with AI-powered message stylization, translation, and context-aware icebreakers.

## Features

- **Duplex Messaging**: Mediates messages between exactly two users
- **AI Stylization**: Rewrites messages using Google Gemma LLM in various styles
- **Translation**: Can be used as a translator between users speaking different languages
- **Icebreakers**: Automatically sends conversation starters when inactive
- **Privacy-First**: Never stores original messages, only stylized versions
- **Web UI**: Simple configuration interface
- **Vercel-Ready**: Deploy for free on Vercel with Redis storage (local uses JSON)

## Tech Stack

- Node.js 18+ (ES Modules)
- Express.js
- Telegram Bot API
- Google Gemini API (Gemma model)
- Storage: JSON (local) / Redis (Vercel)

## Quick Start

### 1. Get API Keys

- **Telegram Bot Token**: Create a bot via [@BotFather](https://t.me/BotFather)
- **Google Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

### 2. Install & Configure

```bash
# Clone and install
git clone https://github.com/alekcangp/ai-facilitator
cd telegram-facilitator-bot
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run Locally

```bash
npm start
```

Web UI available at `http://localhost:3000`

**Note**: Local deployment uses JSON storage (no Redis required).

### 4. Register Users

1. Share the bot with User A → they send any message to register
2. Share the bot with User B → they send any message to register
3. Both users can now message each other through the bot

## Deploy to Vercel

**Note**: Vercel deployment requires Redis storage (unlike local deployment which uses JSON).

### Option 1: Deploy via Vercel Dashboard (UI)

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com) and sign up/login
3. Click "Add New Project" → Import your repository
4. **Create Redis database**: In Vercel dashboard, go to Storage → Create Database → Redis
5. **Connect Redis**: Select your project and click "Connect"
6. Configure environment variables:
   - `BOT_TOKEN`: your Telegram bot token
   - `GEMINI_API_KEY`: your Google Gemini API key
7. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel
vercel login

# Deploy
vercel

# Set environment variables when prompted:
# BOT_TOKEN: your Telegram bot token
# GEMINI_API_KEY: your Google Gemini API key
```

**Note**: After CLI deployment, go to Vercel dashboard → Storage → Create Database → Redis → Connect to your project. The `REDIS_URL` is automatically set when you connect Redis.

### Set Webhook (Required for Vercel)

After deployment, set up the Telegram webhook:

```bash
npm run set-webhook https://your-app.vercel.app
```

## Configuration

Visit the web UI to:
- Select message style (friendly, formal, playful, romantic, intellectual, casual, poetic, or custom)
- Set user language (for translation between users)
- Configure icebreaker period (3-30 days)
- View recent messages
- Reset configuration

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `REDIS_URL` | Vercel only | Redis URL (auto-set when using Vercel Redis) |
| `PORT` | No | Server port (default: 3000) |

**Note**: Local deployment uses JSON storage (no Redis needed). For Vercel deployment, create a Redis database in the Vercel dashboard and connect it to your project. The `REDIS_URL` is automatically configured.

## How It Works

```
User A → Bot → Stylize → User B
User B → Bot → Stylize → User A
```

1. Either user sends a message to the bot
2. Bot detects which user sent it (A or B)
3. Bot stylizes the message using Gemma LLM
4. Bot forwards the stylized message to the other user
5. Bot stores only the stylized version (never the original)

## Privacy

**Stored:** Stylized messages, sender role, timestamps, configuration settings

**NOT Stored:** Original messages, raw Telegram payloads, user personal data beyond usernames

## Scripts

- `npm start` - Start the server
- `npm run dev` - Start with auto-reload
- `npm run set-webhook <url>` - Set Telegram webhook
- `npm run clear-webhook` - Clear Telegram webhook
