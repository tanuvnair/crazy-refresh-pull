/** Decodes common HTML entities (e.g. from YouTube Data API). */
export function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#34;": '"',
    "&#x22;": '"',
    "&#39;": "'",
    "&#x27;": "'",
    "&apos;": "'",
  };
  return text.replace(
    /&(?:amp|lt|gt|quot|apos|#39|#x27|#34|#x22);/g,
    (match) => entities[match] ?? match,
  );
}
