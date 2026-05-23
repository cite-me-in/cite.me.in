// fallow-ignore-file unused-file
export default function truncateWords(text: string, wordCount: number): string {
  const words = text.split(/\s+/);
  if (words.length <= wordCount) return text;
  return `${words.slice(0, wordCount).join(" ")} ...`;
}
