const COOKIE_NAME = "youtube_api_key_encrypted";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }
  
  return null;
}

/**
 * Set a cookie
 */
export function setCookie(name: string, value: string, maxAge: number = COOKIE_MAX_AGE): void {
  if (typeof document === "undefined") return;
  
  document.cookie = `${name}=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Lax`;
}

/**
 * Get the encrypted API key from cookie
 */
export function getApiKeyFromCookie(): string | null {
  return getCookie(COOKIE_NAME);
}

/**
 * Save the encrypted API key to cookie
 */
export function saveApiKeyToCookie(encrypted: string): void {
  if (encrypted) {
    setCookie(COOKIE_NAME, encrypted);
  } else {
    deleteCookie(COOKIE_NAME);
  }
}
