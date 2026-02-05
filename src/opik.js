/**
 * Opik Integration Module
 * 
 * Provides tracing, observability, and storage for LLM operations.
 */

import dotenv from 'dotenv';
import { Opik } from 'opik';

dotenv.config();

// ============================================================================
// CONFIG
// ============================================================================

export const OPIK_CONFIG = {
  apiKey: process.env.OPIK_API_KEY,
  projectName: process.env.OPIK_PROJECT_NAME,
  workspaceName: process.env.OPIK_WORKSPACE || 'default',
};

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================

let opikClient = null;
let isInitialized = false;

export async function initializeOpik() {
  if (isInitialized) return true;

  try {
    if (!OPIK_CONFIG.apiKey) {
      console.warn('OPIK_API_KEY not set. Opik tracing disabled.');
      return false;
    }

    console.log('Initializing Opik:', { projectName: OPIK_CONFIG.projectName });

    opikClient = new Opik(OPIK_CONFIG);
    
    isInitialized = true;
    console.log('Opik initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize Opik:', error.message);
    return false;
  }
}

export function getOpikClient() {
  return opikClient;
}

// ============================================================================
// TRACE CREATION (SDK)
// ============================================================================

export function createSimpleTrace(name, input, output, metadata = {}) {
  if (!isInitialized || !opikClient) return null;

  console.log(`createSimpleTrace: name="${name}"`);
  
  try {
    const trace = opikClient.trace({
      name, input, output,
      metadata: { ...metadata, timestamp: new Date().toISOString() },
    });
    
    trace.end();
    opikClient.flush();
    
    return trace;
  } catch (error) {
    console.error('Failed to create trace:', error.message);
    return null;
  }
}

export function logFeedback(trace, feedback) {
  if (!trace || !isInitialized) return;

  try {
    trace.feedback({ ...feedback, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Failed to log feedback:', error.message);
  }
}

export function getTraceId(trace) {
  return trace?.id || null;
}

// ============================================================================
// CONFIG MANAGEMENT
// ============================================================================

const SETTINGS_TRACE_NAME = 'bot_settings';

export const DEFAULT_CONFIG = {
  language: 'en',
  userA: { telegramId: null, username: null, language: 'auto', customLanguage: '' },
  userB: { telegramId: null, username: null, language: 'auto', customLanguage: '' },
  style: 'friendly',
  customStyle: '',
  stylizationEnabled: true,
  icebreakerPeriodDays: 7
};

export async function readConfig() {
  // Always fetch fresh data from Opik
  if (opikClient) {
    try {
      const traces = await searchOpikTraces(1, `name="${SETTINGS_TRACE_NAME}"`);
      
      if (traces.length > 0 && traces[0]?.input) {
        return { ...DEFAULT_CONFIG, ...traces[0].input };
      }
    } catch (error) {
      console.error('Failed to read config:', error.message);
    }
  }
  
  return { ...DEFAULT_CONFIG };
}

export async function writeConfig(config) {
  if (!isInitialized || !opikClient) {
    console.warn('Opik not initialized, config not persisted');
    return;
  }

  try {
    const traces = await searchOpikTraces(1, `name="${SETTINGS_TRACE_NAME}"`);
    
    if (traces.length > 0 && traces[0]?.id) {
      // Update existing trace by ID
      const existingTrace = opikClient.trace({ id: traces[0].id });
      await existingTrace.update({
        name: SETTINGS_TRACE_NAME,
        input: config,
        output: { stored: true, updated: true },
        metadata: { 
          action: 'config_save',
          updated_at: new Date().toISOString()
        }
      });
    } else {
      // Create new trace
      opikClient.trace({
        name: SETTINGS_TRACE_NAME,
        input: config,
        output: { stored: true },
        metadata: { 
          action: 'config_save',
          created_at: new Date().toISOString()
        },
      });
    }
    
    await opikClient.flush();
  } catch (error) {
    console.error('Failed to write config:', error.message);
  }
}

// ============================================================================
// PROMPT MANAGEMENT
// ============================================================================

const PROMPTS_TRACE_NAME = 'prompt_configs';

export function getDefaultPromptConfig() {
  return {
    prompt: null,
    locked: false,
    lockReason: null,
    lockDate: null,
    lastImprovement: null,
    comments: [],
    improvementCount: 0,
  };
}

/**
 * Get prompt configs - filter locally by style and language
 * @param {string} style - Style to filter (optional)
 * @param {string} language - Language to filter (optional)
 * @returns {Object|Object} - All configs, or single config if style+language provided
 */
export async function getPromptConfig(style, language) {
  if (!opikClient) return style && language ? getDefaultPromptConfig() : {};

  try {
    const traces = await searchOpikTraces(1, `name="${PROMPTS_TRACE_NAME}"`);
    const all = traces[0]?.input?.prompts || {};
    
    if (style && language) {
      return all[style]?.[language] || getDefaultPromptConfig();
    }
    return all;
  } catch (error) {
    console.error('Failed to get prompt config:', error.message);
  }
  return style && language ? getDefaultPromptConfig() : {};
}

export async function updatePromptConfig(style, language, config) {
  if (!isInitialized || !opikClient) {
    return { ...getDefaultPromptConfig(), ...config };
  }

  try {
    let promptsData = { prompts: {} };
    
    const traces = await searchOpikTraces(1, `name="${PROMPTS_TRACE_NAME}"`);
    
    if (traces.length > 0 && traces[0]?.input) {
      promptsData = traces[0].input;
    }
    
    // Update the specific prompt
    if (!promptsData.prompts[style]) promptsData.prompts[style] = {};
    promptsData.prompts[style][language] = {
      ...getDefaultPromptConfig(),
      ...promptsData.prompts[style][language],
      ...config
    };

    if (traces.length > 0 && traces[0]?.id) {
      // Update existing trace
      const existingTrace = opikClient.trace({ id: traces[0].id });
      await existingTrace.update({
        name: PROMPTS_TRACE_NAME,
        input: promptsData,
        output: { stored: true },
        metadata: { 
          action: 'prompt_update',
          updated_at: new Date().toISOString() 
        }
      });
    } else {
      // Create new trace
      opikClient.trace({
        name: PROMPTS_TRACE_NAME,
        input: promptsData,
        output: { stored: true },
        metadata: { 
          action: 'prompt_update',
          created_at: new Date().toISOString() 
        },
      });
    }
    
    await opikClient.flush();
    return promptsData.prompts[style][language];
  } catch (error) {
    console.error('Failed to update prompt:', error.message);
    return { ...getDefaultPromptConfig(), ...config };
  }
}

export async function getAllPromptConfigs() {
  if (!opikClient) return {};

  try {
    const traces = await searchOpikTraces(1, `name="${PROMPTS_TRACE_NAME}"`);
    
    return traces[0]?.input?.prompts || {};
  } catch (error) {
    console.error('Failed to get all prompts:', error.message);
  }
  return {};
}

// ============================================================================
// UNIFIED TRACE SEARCH
// ============================================================================

/**
 * Unified function to search Opik traces
 * @param {number} limit - Max results (optional)
 * @param {string} filterString - Opik filter string (optional)
 * @returns {Array} - Traces
 */
async function searchOpikTraces(limit, filterString = '') {
  if (!opikClient) return [];
  
  try {
    const options = { projectName: OPIK_CONFIG.projectName, apiKey: OPIK_CONFIG.apiKey };
    if (limit) options.maxResults = limit;
    if (filterString) options.filterString = filterString;
    return await opikClient.searchTraces(options);
  } catch (error) {
    console.error('Failed to search traces:', error.message);
    return [];
  }
}

export { searchOpikTraces };

export async function fetchRecentMessagesFromOpik(limit = 20) {
  // Use filter to get only stylize_message traces directly
  const traces = await searchOpikTraces(limit, 'name="stylize_message"');
  
  return traces
    .map(t => ({
      senderRole: t.input?.user_role || 'A',
      username: t.input?.username || '',
      stylizedText: t.output?.result || '',
      timestamp: t.startTime,
      traceId: t.id,
    }))
    .filter(m => m.stylizedText)
}

// ============================================================================
// ICEBREAKER TRACKING
// ============================================================================

/**
 * Get last activity timestamp from stylize_message or generate_icebreaker traces
 */
export async function getLastActivityTimestamp() {
  try {
    // Query recent traces and filter client-side (Opik doesn't support OR)
    const traces = await searchOpikTraces(20);
    
    // Find first trace that is stylize or icebreaker
    const activityTrace = traces.find(t => 
      t.name === 'stylize_message' || t.name === 'generate_icebreaker'
    );
    
    if (activityTrace?.startTime) {
      return new Date(activityTrace.startTime).getTime();
    }
  } catch (error) {
    console.error('Failed to get last activity:', error.message);
  }
  return null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Delete all traces for this project (except settings traces)
 */
export async function deleteAllTraces() {
  if (!opikClient || !OPIK_CONFIG.apiKey) {
    console.warn('Opik not configured, cannot delete traces');
    return { deleted: 0 };
  }

  try {
    const traces = await searchOpikTraces(1000);

    if (traces.length === 0) {
      return { deleted: 0 };
    }

    // Get trace IDs to delete (all traces for complete reset)
    const traceIds = traces.map(t => t.id);

    if (traceIds.length === 0) {
      return { deleted: 0 };
    }

    // Delete traces via REST API
    const apiBase = 'https://www.comet.com/opik/api';
    const workspace = OPIK_CONFIG.workspaceName || 'default';
    const response = await fetch(`${apiBase}/v1/private/traces/delete`, {
      method: 'POST',
      headers: {
        'Authorization': OPIK_CONFIG.apiKey,
        'Comet-Workspace': workspace,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: traceIds }),
    });

    if (response.ok) {
      console.log(`Deleted ${traceIds.length} traces`);
      return { deleted: traceIds.length };
    } else {
      const error = await response.text();
      console.error('Failed to delete traces:', error);
      return { deleted: 0, error };
    }
  } catch (error) {
    console.error('Error deleting traces:', error.message);
    return { deleted: 0, error: error.message };
  }
}
