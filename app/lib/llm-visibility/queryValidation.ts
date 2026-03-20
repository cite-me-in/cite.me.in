function normalizeWords(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isMeaningfulSentence(query: string): boolean {
  const words = normalizeWords(query).split(" ").filter(Boolean);
  return words.length >= 3;
}

export function hasWordChanges(oldQuery: string, newQuery: string): boolean {
  return normalizeWords(oldQuery) !== normalizeWords(newQuery);
}
