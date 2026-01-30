/**
 * Icebreaker System
 * 
 * Periodically sends context-aware icebreakers when conversation is inactive.
 * Icebreakers are bidirectional and match the selected style.
 */

import { generateIcebreaker } from './llm.js';
import {
  readConfig,
  getRecentMessages,
  getLastMessageTimestamp,
  getLastSenderRole,
  updateLastIcebreakerCheck
} from './storage.js';

/**
 * Calculate random icebreaker interval in milliseconds
 * Default: random between 5-10 days
 * 
 * @param {number} periodDays - Base period in days
 * @returns {number} - Interval in milliseconds
 */
function calculateIcebreakerInterval(periodDays) {
  // Add randomness: periodDays ± 2 days, minimum 3 days
  const minDays = Math.max(3, periodDays - 2);
  const maxDays = periodDays + 2;
  const randomDays = minDays + Math.random() * (maxDays - minDays);
  
  return randomDays * 24 * 60 * 60 * 1000; // Convert to milliseconds
}

/**
 * Check if an icebreaker should be sent
 * 
 * @returns {Promise<Object|null>} - Returns icebreaker info if due, null otherwise
 */
export async function checkIcebreakerDue() {
  try {
    const config = await readConfig();
    const lastMessageTimestamp = await getLastMessageTimestamp();
    
    // If no messages have been sent yet, don't send icebreaker
    if (!lastMessageTimestamp) {
      return null;
    }
    
    const timeSinceLastMessage = Date.now() - lastMessageTimestamp;
    const icebreakerInterval = calculateIcebreakerInterval(config.icebreakerPeriodDays);
    
    // Check if enough time has passed
    if (timeSinceLastMessage >= icebreakerInterval) {
      const lastSenderRole = await getLastSenderRole();
      
      // Determine which user should receive the icebreaker (opposite of last sender)
      const recipientRole = lastSenderRole === 'A' ? 'B' : 'A';
      
      // Get recipient's language
      const recipientLanguage = recipientRole === 'A' 
        ? (config.userA.language || 'en') 
        : (config.userB.language || 'en');
      
      // Get recent messages for context
      const recentMessages = await getRecentMessages(20);
      
      // Generate icebreaker in recipient's language
      const icebreakerText = await generateIcebreaker(
        recentMessages,
        config.style,
        config.customStyle,
        recipientLanguage
      );
      
      // Update last check time
      await updateLastIcebreakerCheck();
      
      return {
        recipientRole,
        text: icebreakerText,
        timestamp: Date.now()
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('Error checking icebreaker:', error);
    return null;
  }
}

/**
 * Manually trigger icebreaker check (called on each message)
 * This is the lightweight approach that works on Vercel free tier
 * 
 * @param {Function} sendToUser - Function to send message to a user (role -> Promise)
 * @returns {Promise<boolean>} - True if icebreaker was sent
 */
export async function triggerIcebreakerCheck(sendToUser) {
  try {
    const icebreaker = await checkIcebreakerDue();
    
    if (icebreaker) {
      // Send icebreaker to the recipient
      await sendToUser(icebreaker.recipientRole, icebreaker.text);
      
      console.log(`Icebreaker sent to User ${icebreaker.recipientRole}: ${icebreaker.text}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('Error triggering icebreaker check:', error);
    return false;
  }
}

/**
 * Get next icebreaker due time (for display purposes)
 * 
 * @returns {Promise<Date|null>} - Date when next icebreaker is due, or null
 */
export async function getNextIcebreakerDue() {
  try {
    const config = await readConfig();
    const lastMessageTimestamp = await getLastMessageTimestamp();
    
    if (!lastMessageTimestamp) {
      return null;
    }
    
    const icebreakerInterval = calculateIcebreakerInterval(config.icebreakerPeriodDays);
    const dueTime = lastMessageTimestamp + icebreakerInterval;
    
    return new Date(dueTime);
    
  } catch (error) {
    console.error('Error getting next icebreaker due:', error);
    return null;
  }
}
