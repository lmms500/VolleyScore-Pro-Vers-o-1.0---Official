
/**
 * Security Utilities for VolleyScore Pro
 * Implements Input Sanitization and Validation Guardrails
 */

const MAX_INPUT_LENGTH = 30; // Max chars for names
const ALLOWED_CHARS_REGEX = /[^a-zA-Z0-9 \-\.\'\u00C0-\u00FF]/g; // Alphanumeric, spaces, basic punctuation, accents

/**
 * Sanitizes user input to prevent XSS and generic injection.
 * Uses a strict whitelist approach (Allow-list).
 * 
 * @param input The raw string input
 * @param maxLength Optional override for max length
 * @returns Sanitized string
 */
export const sanitizeInput = (input: string, maxLength: number = MAX_INPUT_LENGTH): string => {
  if (typeof input !== 'string') return '';
  
  // 1. Trim whitespace
  let clean = input.trim();
  
  // 2. Remove characters not in the allow-list
  // This effectively strips < > / ; ( ) and other dangerous chars used in XSS
  clean = clean.replace(ALLOWED_CHARS_REGEX, '');
  
  // 3. Enforce Max Length to prevent DoS via large payloads
  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  
  return clean;
};

/**
 * Validates if a score operation is mathematically legal based on current state.
 * @param currentScore Current score value
 * @param delta Change amount
 * @returns boolean
 */
export const isValidScoreOperation = (currentScore: number, delta: number): boolean => {
  const result = currentScore + delta;
  // Prevent negative scores
  if (result < 0) return false;
  // Prevent absurdly high scores (sanity check)
  if (result > 200) return false; 
  return true;
};

/**
 * Validates timeout requests.
 * @param currentTimeouts Number of timeouts used
 * @param maxTimeouts Max allowed (usually 2)
 * @returns boolean
 */
export const isValidTimeoutRequest = (currentTimeouts: number, maxTimeouts: number = 2): boolean => {
  return currentTimeouts < maxTimeouts;
};
