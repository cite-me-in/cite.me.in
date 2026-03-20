/**
 * Checks if a query is a meaningful sentence. For simplicity, we only check if
 * the query is at least 3 words long.
 *
 * @param query - The query to check.
 * @returns True if the query is a meaningful sentence, false otherwise.
 */
export function isMeaningfulSentence(query: string): boolean {
  const words = normalizeWords(query).split(" ").filter(Boolean);
  return words.length >= 3;
}

/**
 * Checks if a query has changed. For simplicity, we only check if the query has
 * changed by more than just whitespace.
 *
 * @param oldQuery - The old query.
 * @param newQuery - The new query.
 * @returns True if the query has changed, false otherwise.
 */
export function hasWordChanges(oldQuery: string, newQuery: string): boolean {
  return normalizeWords(oldQuery) !== normalizeWords(newQuery);
}

function normalizeWords(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
