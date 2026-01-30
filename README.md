# Telegram Facilitator Bot

A 1-to-1 duplex Telegram bot that mediates messages between two users with AI-powered message stylization and context-aware icebreakers.

## Features

- **Duplex Messaging**: Mediates messages between exactly two users (User A and User B)
- **AI Stylization**: Rewrites messages using Google Gemma LLM in various styles
- **Icebreakers**: Automatically sends natural conversation starters when inactive
- **Privacy-First**: Never stores original messages, only stylized versions
- **Web UI**: Simple configuration interface (no authentication required)
- **Vercel-Ready**: Deploy for free on Vercel

## Tech Stack

- Node.js (ES Modules)
- Express.js
- Telegram Bot API
- Google Gemini API (Gemma model)
- File-based JSON storage

## Project Structure

```
telegram-facilitator-bot/
├── src/
│   ├── server.js       # Express server with web UI
│   ├── bot.js          # Telegram bot logic
│   ├── llm.js          # LLM service for stylization
│   ├── icebreaker.js   # Icebreaker system
│   └── storage.js      # File-based persistence
├── data/               # Created at runtime (gitignored)
│   ├── config.json     # Bot configuration
│   └── messages.json   # Stylized message history
├── .env.example        # Environment variables template
├── vercel.json         # Vercel deployment config
├── package.json
└── README.md
```

## Setup Instructions

### 1. Prerequisites

- Node.js 18 or higher
- A Telegram account
- A Google account (for Gemini API)

### 2. Get API Keys

#### Telegram Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the instructions
3. Copy the bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
4. Save it for later

**Important:** If you plan to use both local development and Vercel deployment, create TWO separate bots and use different tokens for each environment. Telegram only allows one active consumer per bot token.

#### Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key
5. Save it for later

### 3. Local Development

#### Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd telegram-facilitator-bot

# Install dependencies
npm install
```

#### Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API keys
# BOT_TOKEN=your_bot_token_here
# GEMINI_API_KEY=your_gemini_api_key_here
```

#### Run Locally

```bash
# If you previously set up a webhook, clear it first
npm run clear-webhook

# Start the server
npm start

# Or run in development mode with auto-reload
npm run dev
```

The bot will start and the web UI will be available at `http://localhost:3000`

**Note:** If you encounter polling errors, run `npm run clear-webhook` to remove any existing webhook before starting the bot locally.

### 4. Register Users

1. Share the bot with the first person (User A)
2. Have them send any message to the bot
3. They will be automatically registered as User A
4. Share the bot with the second person (User B)
5. Have them send any message to the bot
6. They will be automatically registered as User B

Now both users can message each other through the bot!

### 5. Configure Settings

Visit the web UI at `http://localhost:3000` to:

- Select a message style (friendly, formal, playful, romantic, intellectual, casual, poetic, or custom)
- Set custom style description
- Configure icebreaker period (3-30 days)
- View recent messages
- Reset configuration

## Deployment on Vercel

### Option 1: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Set environment variables when prompted:
# - BOT_TOKEN: your Telegram bot token
# - GEMINI_API_KEY: your Google Gemini API key
```

### Option 2: Deploy via Vercel Dashboard

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com) and sign up/login
3. Click "Add New Project"
4. Import your repository
5. Configure environment variables:
   - `BOT_TOKEN`: your Telegram bot token
   - `GEMINI_API_KEY`: your Google Gemini API key
6. Click "Deploy"

### Set Webhook (Required for Vercel)

After deployment, you need to set up a Telegram webhook:

```bash
# Using the provided script
npm run set-webhook https://your-app.vercel.app

# Or using curl
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-app.vercel.app/api/webhook"
```

Replace `your-app.vercel.app` with your actual Vercel deployment URL.

## How It Works

### Duplex Message Flow

```
User A → Bot → Stylize → User B
User B → Bot → Stylize → User A
```

1. Either user sends a message to the bot
2. Bot detects which user sent it (A or B)
3. Bot stylizes the message using Gemma LLM
4. Bot forwards the stylized message to the other user
5. Bot stores only the stylized version (never the original)

### Message Stylization

The bot uses Google's Gemma LLM to rewrite messages in the selected style:

- **Friendly**: Warm, casual, and conversational
- **Formal**: Professional, polite, and respectful
- **Playful**: Fun, lighthearted, and enthusiastic
- **Romantic**: Affectionate, caring, and intimate
- **Intellectual**: Thoughtful, analytical, and articulate
- **Casual**: Relaxed, informal, and natural
- **Poetic**: Expressive, metaphorical, and artistic
- **Custom**: Your own description

### Icebreaker System

Icebreakers are sent automatically when the conversation is inactive:

- Default interval: Random between 5-10 days
- Configurable period: 3-30 days
- Random variation: ±2 days from the set period
- Icebreakers are sent to the opposite user of the last sender
- Icebreakers match the selected style
- Never mentions inactivity or time passed

### Privacy & Storage

**What is stored:**
- Stylized messages only
- Sender role (A or B)
- Timestamps
- Configuration settings

**What is NOT stored:**
- Original messages
- Raw Telegram payloads
- User personal data beyond usernames

Storage is file-based (JSON) and compatible with Vercel's filesystem constraints.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `PORT` | No | Server port (default: 3000) |



