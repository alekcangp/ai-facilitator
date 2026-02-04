/**
 * Icebreaker System
 *
 * Periodically sends context-aware icebreakers when conversation is inactive.
 * Icebreakers are sent to BOTH users when timer is due.
 *
 * Uses Opik traces for persistent timestamp storage (works on Vercel).
 *
 * @module icebreaker
 */

import { generateIcebreaker } from './llm.js';
import { readConfig, fetchRecentMessagesFromOpik, getLastActivityTimestamp } from './opik.js';

// Local scheduler interval
let localSchedulerInterval = null;

/**
 * Start local icebreaker scheduler (for local development)
 * Runs independently and sends icebreakers when due
 * 
 * @param {Function} sendToUser - Function to send message (role, text) => Promise
 * @param {number} checkIntervalMs - How often to check (default: 1 hour)
 */
export function startLocalScheduler(sendToUser, checkIntervalMs = 3600000) {
  if (localSchedulerInterval) {
    console.log('[Icebreaker] Scheduler already running');
    return;
  }
  
  console.log(`[Icebreaker] Starting local scheduler (every ${checkIntervalMs / 60000} minutes)`);
  
  // Run initial check
  checkAndSendIcebreaker(sendToUser);
  
  // Set interval
  localSchedulerInterval = setInterval(() => {
    checkAndSendIcebreaker(sendToUser);
  }, checkIntervalMs);
}

/**
 * Calculate random icebreaker interval in milliseconds
 * Default: random between periodDays ± 2 days, minimum 3 days
 * 
 * @param {number} periodDays - Base period in days
 * @returns {number} - Interval in milliseconds
 */
function calculateIcebreakerInterval(periodDays) {
  const minDays = Math.max(3, periodDays - 2);
  const maxDays = periodDays + 2;
  const randomDays = minDays + Math.random() * (maxDays - minDays);
  
  return randomDays * 24 * 60 * 60 * 1000;
}

/**
 * Check and send icebreaker if due
 * Sends to both users when timer is due
 */
async function checkAndSendIcebreaker(sendToUser) {
  try {
    const config = await readConfig();
    const lastActivityTimestamp = await getLastActivityTimestamp();
    
    // If no activity yet, don't send icebreaker
    if (!lastActivityTimestamp) {
      return;
    }
    
    const timeSinceLastActivity = Date.now() - lastActivityTimestamp;
    const icebreakerInterval = calculateIcebreakerInterval(config.icebreakerPeriodDays);
    
    // Check if enough time has passed
    if (timeSinceLastActivity < icebreakerInterval) {
      return;
    }
    
    // Time is due - send icebreakers to BOTH users
    const recentMessages = await fetchRecentMessagesFromOpik(20);
    
    // Generate and send to User A
    const languageA = config.userA.language === 'auto' 
      ? (config.userA.languageCode || 'en') 
      : config.userA.language;
    const icebreakerA = await generateIcebreaker(
      recentMessages,
      config.style,
      config.customStyle,
      languageA
    );
    await sendToUser('A', icebreakerA);
    console.log(`[Icebreaker] Sent to User A: ${icebreakerA}`);
    
    // Generate and send to User B
    const languageB = config.userB.language === 'auto'
      ? (config.userB.languageCode || 'en')
      : config.userB.language;
    const icebreakerB = await generateIcebreaker(
      recentMessages,
      config.style,
      config.customStyle,
      languageB
    );
    await sendToUser('B', icebreakerB);
    console.log(`[Icebreaker] Sent to User B: ${icebreakerB}`);
    
  } catch (error) {
    console.error('[Icebreaker] Error:', error.message);
  }
}

/**
 * Trigger scheduled icebreaker check (called by GitHub Actions cron)
 * Sends icebreakers to both users using the provided sendToUser function
 * 
 * @param {Function} sendToUser - Function to send message (role, text) => Promise
 * @returns {Object} - Result with sent status
 */
export async function triggerScheduledIcebreaker(sendToUser) {
  await checkAndSendIcebreaker(sendToUser);
  return { sent: true };
}

/**
 * Manually trigger icebreaker check (called on each message)
 * 
 * @param {Function} sendToUser - Function to send message (role, text) => Promise
 */
export async function triggerIcebreakerCheck(sendToUser) {
  try {
    await checkAndSendIcebreaker(sendToUser);
    return true;
  } catch (error) {
    console.error('Error triggering icebreaker check:', error);
    return false;
  }
}

/**
 * Get next icebreaker due time (for UI display)
 * 
 * @returns {Promise<Date|null>} - Date when next icebreaker is due, or null
 */
export async function getNextIcebreakerDue() {
  try {
    const config = await readConfig();
    const lastActivityTimestamp = await getLastActivityTimestamp();
    
    if (!lastActivityTimestamp) {
      return null;
    }
    
    const icebreakerInterval = calculateIcebreakerInterval(config.icebreakerPeriodDays);
    const dueTime = lastActivityTimestamp + icebreakerInterval;
    
    return new Date(dueTime);
    
  } catch (error) {
    console.error('Error getting next icebreaker due:', error);
    return null;
  }
}
