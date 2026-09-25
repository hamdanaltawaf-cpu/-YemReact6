import type { Reaction } from './reactions';

/** A curated set; membership is independent of the reaction's legacy category. */
export type CollectionKind = 'thematic' | 'person' | 'place';
export type Collection = {
  slug: string;
  kind: CollectionKind;
  title: string;
  description: string;
  cover: string | null;
  coverCode: string | null;
  memberCodes: string[];
  count: number;
  active: boolean;
};

export function collectionMembers(collection: Collection, reactions: Reaction[]) {
  const codes = new Set(collection.memberCodes);
  return reactions.filter((reaction) => codes.has(reaction.code));
}

function hash(text: string) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

/** No repeated cards; both sections grow to their specified limits as the catalog grows. */
export function detailRecommendations(
  reaction: Reaction,
  reactions: Reaction[],
  collections: Collection[],
) {
  const groups = collections.filter((collection) => collection.memberCodes.includes(reaction.code));
  const relevance = (item: Reaction) =>
    groups.filter((collection) => collection.memberCodes.includes(item.code)).length * 5 +
    item.keywords.filter((word) => reaction.keywords.includes(word)).length +
    (item.category === reaction.category ? 1 : 0);
  const candidates = reactions.filter((item) => item.code !== reaction.code);
  const related = [...candidates]
    .sort((a, b) => relevance(b) - relevance(a) || a.code.localeCompare(b.code))
    .slice(0, 10);
  const selected = new Set(related.map((item) => item.code));
  const more = candidates
    .filter((item) => !selected.has(item.code))
    .sort((a, b) => hash(`${reaction.code}:${a.code}`) - hash(`${reaction.code}:${b.code}`))
    .slice(0, 20);
  return { related, more };
}
