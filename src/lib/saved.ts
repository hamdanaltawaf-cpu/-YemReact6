import type { Reaction } from './reactions';
/** No search, category or duration gate: images and videos are equally eligible. */
export function savedReactions(reactions: Reaction[], saved: string[]) {
  const codes = new Set(saved);
  return reactions
    .filter((reaction) => codes.has(reaction.code))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
