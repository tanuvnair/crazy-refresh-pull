// Simple encryption/obfuscation for API key storage
// Note: This is client-side obfuscation, not true security.
// The API key will still be visible in network requests.

import { log } from "~/lib/logger";

const ENCRYPTION_KEY = "crazy-refresh-pull-secret-key-2024";

/**
 * Encrypts a string using a simple XOR cipher
 */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext) return "";
  
  let encrypted = "";
  for (let i = 0; i < plaintext.length; i++) {
    const keyChar = ENCRYPTION_KEY[i % ENCRYPTION_KEY.length];
    const encryptedChar = String.fromCharCode(
      plaintext.charCodeAt(i) ^ keyChar.charCodeAt(0)
    );
    encrypted += encryptedChar;
  }
  
  // Base64 encode to make it safe for storage
  return btoa(encrypted);
}

/**
 * Decrypts an encrypted string
 */
export function decryptApiKey(encrypted: string): string {
  if (!encrypted) return "";
  
  try {
    // Base64 decode first
    const decoded = atob(encrypted);
    
    let decrypted = "";
    for (let i = 0; i < decoded.length; i++) {
      const keyChar = ENCRYPTION_KEY[i % ENCRYPTION_KEY.length];
      const decryptedChar = String.fromCharCode(
        decoded.charCodeAt(i) ^ keyChar.charCodeAt(0)
      );
      decrypted += decryptedChar;
    }
    
    return decrypted;
  } catch (error) {
    log.error("encryption: failed to decrypt API key", {
      message: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
}
