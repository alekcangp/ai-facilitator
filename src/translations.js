/**
 * Translations for UI and bot messages
 * Supports English (en) and Russian (ru)
 */

export const translations = {
  en: {
    // UI - Header
    title: '🤖 Telegram Facilitator Bot',
    subtitle: '1-to-1 duplex messaging with AI stylization and translation',
    
    // UI - Connected Users
    connectedUsers: '👥 Connected Users',
    userA: 'User A',
    userB: 'User B',
    user: 'User',
    userALanguage: 'User A Language',
    userBLanguage: 'User B Language',
    nextIcebreaker: 'Next Icebreaker',
    notRegistered: 'Not registered',
    noMessagesYet: 'No messages yet',
    dueNow: 'Due now',
    days: 'days',
    languageLabel: 'Language:',
    
    // UI - Settings
    settings: '⚙️ Settings',
    messageStyle: 'Message Style',
    stylizationEnabled: 'Enable AI Stylization',
    stylizationEnabledHelp: 'When disabled, messages are forwarded as-is or translated (if languages differ) without style changes.',
    customStyle: 'Custom Style Description',
    customStylePlaceholder: 'e.g., witty, sarcastic, philosophical',
    customStyleHelp: 'Describe how messages should be rewritten',
    icebreakerPeriod: 'Icebreaker Period (days)',
    icebreakerPeriodHelp: 'Random interval: ±2 days from this value (minimum 3 days)',
    saveSettings: 'Save Settings',
    language: 'Language',
    custom: 'Custom',
    
    // Style names
    styleFriendly: 'Friendly',
    styleFormal: 'Formal',
    stylePlayful: 'Playful',
    styleRomantic: 'Romantic',
    styleIntellectual: 'Intellectual',
    styleCasual: 'Casual',
    stylePoetic: 'Poetic',
    
    // Style descriptions
    styleFriendlyDesc: 'warm, casual, and conversational',
    styleFormalDesc: 'professional, polite, and respectful',
    stylePlayfulDesc: 'fun, lighthearted, and enthusiastic',
    styleRomanticDesc: 'affectionate, caring, and intimate',
    styleIntellectualDesc: 'thoughtful, analytical, and articulate',
    styleCasualDesc: 'relaxed, informal, and natural',
    stylePoeticDesc: 'expressive, metaphorical, and artistic',
    
    // UI - Recent Messages
    recentMessages: '💬 Messages',
    lastMessages: 'Last 5 stylized messages:',
    noMessages: 'No messages yet',
    
    // UI - Reset
    reset: '🔄 Reset',
    resetDescription: 'Reset all settings to defaults. This will also delete message history.',
    resetConfig: 'Reset Configuration',
    resetConfirm: 'Are you sure you want to reset all configuration and delete message history?',
    
    // UI - Footer
    footer: 'Gemini • Opik • Vercel',
    
    // UI - Messages
    settingsSaved: '✓ Settings saved successfully!',
    saveFailed: 'Failed to save settings',
    saveError: 'Error saving settings: ',
    resetFailed: 'Failed to reset configuration',
    resetError: 'Error resetting configuration: ',
    
    // Feedback Loop
    feedbackLoop: 'Feedback Loop',
    running: 'Active',
    stopped: 'Stopped',
    adjustments: 'Improvements',
    userAdjustments: 'today',
    llmAdjustments: 'LLM',
    runNow: 'Refresh',
    feedbackLoopCompleted: 'Feedback loop completed!',
    improvementsApplied: 'improvement(s) applied:',
    noImprovementsNeeded: 'No improvements needed.',
    
    // Feedback command
    feedbackUsage: 'Usage: /feedback <your comment>\n\nExample: /feedback Add more warmth and emoji',
    noMessageToRate: 'No message to provide feedback on. First receive a stylized message.',
    feedbackThanks: 'Thank you for your feedback! I will consider your comment',
    feedbackThanksImproved: 'Thank you for your feedback! I have improved the style based on your comment',
    feedbackError: 'Error processing feedback. Please try again later.',
    
    // Metrics
    metricCompleteness: 'Completeness',
    metricPerspective: 'Perspective',
    metricGrammar: 'Grammar',
    metricAppropriateness: 'Appropriateness',
    metricNaturalness: 'Naturalness',
    metricClarity: 'Clarity',
    metricUserRating: 'User Rating',
    messageQuality: 'Message quality',
    evaluationMetrics: 'Evaluation Metrics',
    feedback: 'Feedback',
    lastFeedback: 'Last feedback:',
    loading: 'Loading...',
    noEvaluations: 'No evaluations yet',
    noFeedback: 'No feedback yet',
    
    // Bot messages
    welcomeUserA: '👋 Welcome! You are now registered as User A.\n\nPlease share this bot with the person you want to connect with. They will be automatically registered as User B.',
    welcomeUserB: '👋 Welcome! You are now registered as User B.\n\nYou can now start messaging! Your messages will be forwarded to User A.',
    otherUserNotRegistered: '⚠️ The other user has not registered yet. Please share this bot with them.',
    
    // Language names
    english: 'English',
    russian: 'Russian',
    spanish: 'Spanish',
    french: 'French',
    german: 'German',
    auto: 'Auto (from sender)',
    autoDetect: 'Use sender Telegram language',
    autoDetectHelp: 'The bot will use the sender Telegram language setting'
  },
  
  ru: {
    // UI - Header
    title: '🤖 Telegram Фасилитатор Бот',
    subtitle: 'Дуплексная переписка 1-на-1 с AI стилизацией и переводом',
    
    // UI - Connected Users
    connectedUsers: '👥 Подключенные пользователи',
    userA: 'Пользователь A',
    userB: 'Пользователь B',
    user: 'Пользователь',
    userALanguage: 'Язык пользователя A',
    userBLanguage: 'Язык пользователя B',
    nextIcebreaker: 'Следующий ледокол',
    notRegistered: 'Не зарегистрирован',
    noMessagesYet: 'Сообщений пока нет',
    dueNow: 'Должен быть сейчас',
    days: 'дней',
    languageLabel: 'Язык:',
    
    // UI - Settings
    settings: '⚙️ Настройки',
    messageStyle: 'Стиль сообщений',
    stylizationEnabled: 'Включить AI стилизацию',
    stylizationEnabledHelp: 'Когда отключено, сообщения пересылаются как есть или переводятся (если языки различаются) без изменения стиля.',
    customStyle: 'Описание пользовательского стиля',
    customStylePlaceholder: 'например: остроумный, саркастичный, философский',
    customStyleHelp: 'Опишите, как должны переписываться сообщения',
    icebreakerPeriod: 'Период ледокола (дни)',
    icebreakerPeriodHelp: 'Случайный интервал: ±2 дня от этого значения (минимум 3 дня)',
    saveSettings: 'Сохранить настройки',
    language: 'Язык',
    custom: 'Пользовательский',
    
    // Style names
    styleFriendly: 'Дружелюбный',
    styleFormal: 'Формальный',
    stylePlayful: 'Игривый',
    styleRomantic: 'Романтичный',
    styleIntellectual: 'Интеллектуальный',
    styleCasual: 'Непринужденный',
    stylePoetic: 'Поэтичный',
    
    // Style descriptions
    styleFriendlyDesc: 'теплый, непринужденный и разговорный',
    styleFormalDesc: 'профессиональный, вежливый и уважительный',
    stylePlayfulDesc: 'забавный, легкомысленный и энтузиастичный',
    styleRomanticDesc: 'нежный, заботливый и интимный',
    styleIntellectualDesc: 'обдуманный, аналитический и выразительный',
    styleCasualDesc: 'расслабленный, неформальный и естественный',
    stylePoeticDesc: 'экспрессивный, метафоричный и художественный',
    
    // UI - Recent Messages
    recentMessages: '💬 Cообщения',
    lastMessages: 'Последние 5 стилизованных сообщений:',
    noMessages: 'Сообщений пока нет',
    
    // UI - Reset
    reset: '🔄 Сброс',
    resetDescription: 'Сбросить все настройки по умолчанию. Это также удалит историю сообщений.',
    resetConfig: 'Сбросить конфигурацию',
    resetConfirm: 'Вы уверены, что хотите сбросить всю конфигурацию и удалить историю сообщений?',
    
    // UI - Footer
    footer: 'Gemini • Opik • Vercel',
    
    // UI - Messages
    settingsSaved: '✓ Настройки успешно сохранены!',
    saveFailed: 'Не удалось сохранить настройки',
    saveError: 'Ошибка сохранения настроек: ',
    resetFailed: 'Не удалось сбросить конфигурацию',
    resetError: 'Ошибка сброса конфигурации: ',
    
    // Feedback Loop
    feedbackLoop: 'Обратная связь',
    running: '',
    stopped: 'Остановлена',
    adjustments: 'Улучшения',
    userAdjustments: 'сегодня',
    llmAdjustments: 'LLM',
    runNow: 'Обновить',
    feedbackLoopCompleted: 'Цикл обратной связи завершен!',
    improvementsApplied: 'улучшение(й) применено:',
    noImprovementsNeeded: 'Улучшения не требуются.',
    
    // Feedback command
    feedbackUsage: 'Использование: /feedback <ваш комментарий>\n\nНапример: /feedback Добавь больше тепла и эмодзи',
    noMessageToRate: 'Нет сообщения для отзыва. Сначала получите стилизованное сообщение.',
    feedbackThanks: 'Спасибо за отзыв! Я учту ваш комментарий',
    feedbackThanksImproved: 'Спасибо за отзыв! Я улучшил стиль на основе вашего комментария',
    feedbackError: 'Ошибка при обработке отзыва. Попробуйте позже.',
    
    // Metrics
    metricCompleteness: 'Полнота',
    metricPerspective: 'Взгляд',
    metricGrammar: 'Грамматика',
    metricAppropriateness: 'Уместность',
    metricNaturalness: 'Естественность',
    metricClarity: 'Ясность',
    metricUserRating: 'Оценка пользователей',
    messageQuality: 'Качество сообщения',
    evaluationMetrics: 'Метрики оценки',
    feedback: 'Обратная связь',
    lastFeedback: 'Комментарий:',
    loading: 'Загрузка...',
    noEvaluations: 'Оценок пока нет',
    noFeedback: 'Отзывов пока нет',
    
    // Bot messages
    welcomeUserA: '👋 Добро пожаловать! Вы теперь зарегистрированы как Пользователь A.\n\nПожалуйста, поделитесь этим ботом с человеком, с которым хотите связаться. Он будет автоматически зарегистрирован как Пользователь B.',
    welcomeUserB: '👋 Добро пожаловать! Вы теперь зарегистрированы как Пользователь B.\n\nТеперь вы можете начать переписку! Ваши сообщения будут пересылаться Пользователю A.',
    otherUserNotRegistered: '⚠️ Другой пользователь еще не зарегистрирован. Пожалуйста, поделитесь этим ботом с ним.',
    
    // Language names
    english: 'English',
    russian: 'Русский',
    spanish: 'Испанский',
    french: 'Французский',
    german: 'Немецкий',
    auto: 'Авто (от отправителя)',
    autoDetect: 'Использовать язык Telegram отправителя',
    autoDetectHelp: 'Бот будет использовать настройку языка Telegram отправителя'
  }
};

/**
 * Get translation for a key in the specified language
 * @param {string} language - 'en' or 'ru'
 * @param {string} key - Translation key (supports dot notation for nested keys)
 * @returns {string} - Translated text
 */
export function t(language, key) {
  const lang = translations[language] || translations.en;
  const keys = key.split('.');
  let value = lang;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to English if key not found
      const enLang = translations.en;
      value = enLang;
      for (const ek of keys) {
        if (value && typeof value === 'object' && ek in value) {
          value = value[ek];
        } else {
          return key; // Return key if not found
        }
      }
      break;
    }
  }
  
  return typeof value === 'string' ? value : key;
}

/**
 * Translate style name to localized version
 * @param {string} style - Style key (e.g., 'friendly', 'formal')
 * @param {string} language - Language code ('en' or 'ru')
 * @returns {string} - Translated style name
 */
export function translateStyleName(style, language = 'en') {
  const styleKey = 'style' + style.charAt(0).toUpperCase() + style.slice(1);
  const translated = t(language, styleKey);
  return translated !== styleKey ? translated : style;
}

/**
 * Translate language code to localized version
 * @param {string} langCode - Language code (e.g., 'en', 'ru')
 * @param {string} language - UI language ('en' or 'ru')
 * @returns {string} - Translated language name
 */
export function translateLanguageName(langCode, language = 'en') {
  const langMap = {
    en: 'english',
    ru: 'russian',
    es: 'spanish',
    fr: 'french',
    de: 'german'
  };
  const key = langMap[langCode] || langCode;
  const translated = t(language, key);
  return translated !== key ? translated : langCode;
}
