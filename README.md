# Telegram Facilitator Bot

1-to-1 Telegram bot with AI message stylization, translation, and automatic icebreakers.

## Key Features

- **Duplex Messaging** - Connects exactly two users via bot
- **AI Stylization** - Rewrites messages using Gemma LLM (7 styles)
- **Translation** - Auto-translate between users speaking different languages
- **Icebreakers** - Sends conversation starters when conversation goes idle
- **User Feedback** - Users can rate messages with `/feedback` command
- **Auto-Improvement** - Prompts improve based on feedback and evaluations


## Architecture

```
User A → Telegram → Bot → Gemma Stylization → Telegram → User B
                    ↓
                   Opik (tracing + scores + storage)
```

## How It Works

1. User sends message to bot
2. Bot identifies sender (A or B)
3. Gemma rewrites message in selected style
4. Bot forwards to other user
5. Trace stored in Opik

---

## Gemma Integration

**Purpose**: Message stylization, translation and icebreaker generation

**Model**: `gemma-3-27b-it`

**Usage** ([`src/llm.js`](src/llm.js)):
- [`stylizeMessage()`](src/llm.js:59) - Rewrites message in requested style
- [`generateIcebreaker()`](src/llm.js:147) - Creates context-aware conversation starters

---

## Opik Integration

**Purpose**: LLM observability, evaluation, tracing, and storage

**Storage** ([`src/opik.js`](src/opik.js)):
- **Traces** - Logs all LLM calls (inputs, outputs, latency)
- **Config** - Persists bot configuration
- **Prompts** - Stores improved prompts per style/language
- **Messages** - Stores conversation history for icebreakers

**Key Functions**:
- [`createSimpleTrace()`](src/opik.js:58) - Log LLM operations
- [`getPromptConfig()`](src/opik.js:204) - Retrieve stored prompts
- [`updatePromptConfig()`](src/opik.js:221) - Save improved prompts
- [`fetchRecentMessagesFromOpik()`](src/opik.js:315) - Get conversation history

---

## User Feedback & Auto-Improvement

### User Feedback Command

Users can provide feedback on stylized messages:

```
/feedback Your comment here
```

Example: `/feedback Add more warmth and emoji`

**Flow** ([`src/user-feedback.js`](src/user-feedback.js)):
1. User sends `/feedback <comment>`
2. Bot analyzes comment using Gemma
3. Prompt is improved based on feedback
4. Improvement is stored in Opik

### Evaluation-Based Improvement

Automatic prompt improvement based on evaluation scores ([`src/opik-feedback.js`](src/opik-feedback.js)):
- Evaluates message quality every 10 messages
- Improves prompts when scores drop below 0.7 threshold
- Max 10 improvements per day per style/language

---

## Opik Setup Required

**Important**: Before deploying, create in Opik:

1. **Create Project**: Go to Opik → Projects → Create Project
   - Note your project name (set in `OPIK_PROJECT_NAME`)

2. **Create Online Evaluation Rule**: Go to Project Page → Online Evaluations → Create New Rule
   - Select the LLM-as-a-Judge prompt to use. [Read more](https://www.comet.com/docs/opik/production/rules?from=llm#writing-your-own-llm-as-a-judge-metric)
   - Configure metrics, for example: completeness, perspective, grammar, appropriateness, naturalness, clarity

---

## Vercel Deployment

### Setup

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → Add New Project
3. Import your repository
4. Add environment variables:
   - `BOT_TOKEN` - Telegram bot token
   - `GEMINI_API_KEY` - Google Gemini API key
   - `OPIK_API_KEY` - Opik API key
   - `OPIK_PROJECT_NAME` - Your Opik project name
5. Deploy

### Set Webhook
```bash
npm run set-webhook https://your-app.vercel.app
```

### GitHub Actions Cron

Automated icebreaker checking via GitHub Actions (runs every hour)

**Setup**:
1. Push code to GitHub with workflow file (`.github/workflows/cron-icebreaker.yml`)
2. In your GitHub repository: **Settings → Secrets and variables → Actions**
3. Add repository secret:
   - `CRON_URL` - `https://your-app.vercel.app/api/cron/icebreaker`


---

## Install & Register Users

### 1. Add Bot to Telegram

 Open Telegram and search for your bot username

### 2. Register Users

**User A** (first user):
- Sends `/start` to the bot
- Automatically registered as User A
- Bot welcomes and suggest to share

**User B** (second user):
- Sends `/start` to the bot
- Automatically registered as User B
- Bot confirms registration

### 3. Start Messaging

Once both users are registered:
- User A sends a message → Bot stylizes → User B receives
- User B sends a message → Bot stylizes → User A receives

### Reset & Re-register

If you reset the bot in the UI:
- Both users need to re-register
- Each user sends any message to the bot
- User A registers first, User B second

---

## Local Development

```bash
# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your API keys

# Run
npm start
# Web UI: http://localhost:3000
```

---

## Configuration

Access web UI to:

- Select style: friendly, formal, playful, romantic, intellectual, casual, poetic
- Set user languages (auto-detect or manual)
- Configure icebreaker period (3-30 days)
- View registered users, message history and metrics.

