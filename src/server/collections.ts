import 'server-only';
import { db, findReaction } from './db';
import { ApiError } from './auth';
import type { Collection, CollectionKind } from '@/lib/collections';

type Row = {
  slug: string;
  title: string;
  description: string;
  kind: CollectionKind;
  cover_code: string | null;
  active: number;
};
type Member = { slug: string; code: string };
export type CollectionInput = {
  slug: string;
  kind: CollectionKind;
  title: string;
  description: string;
  coverCode: string | null;
  memberCodes: string[];
  active: boolean;
};

/** Return only safe cover URLs from saved reaction records, never client-provided paths. */
export function listCollections(includeDrafts = false): Collection[] {
  const rows = db
    .prepare(
      'SELECT slug,title,description,cover_code,active,kind FROM collections ORDER BY created_at,slug',
    )
    .all() as Row[];
  const members = db
    .prepare('SELECT slug,code FROM collection_items ORDER BY slug,position')
    .all() as Member[];
  return rows
    .map((row) => {
      const codes = members
        .filter((member) => member.slug === row.slug)
        .map((member) => member.code);
      const reaction = findReaction(row.cover_code || codes[0] || '');
      return {
        slug: row.slug,
        kind: row.kind,
        title: row.title,
        description: row.description,
        cover: reaction?.poster || null,
        coverCode: row.cover_code,
        memberCodes: codes,
        count: codes.length,
        active: row.active === 1,
      };
    })
    .filter((collection) => includeDrafts || (collection.active && collection.count > 0));
}
export const collectionBySlug = (slug: string) =>
  listCollections().find((collection) => collection.slug === slug);
export const collectionsForReaction = (code: string) =>
  listCollections().filter((collection) => collection.memberCodes.includes(code));

export function saveCollection(input: CollectionInput, edit: boolean) {
  const memberCodes = [...new Set(input.memberCodes)];
  if (input.active && !memberCodes.length)
    throw new ApiError(400, 'أضف رياكشنًا واحدًا على الأقل قبل نشر المجموعة.');
  if (input.coverCode && !memberCodes.includes(input.coverCode))
    throw new ApiError(400, 'غلاف المجموعة يجب أن يكون أحد رياكشناتها.');
  if (memberCodes.some((code) => !findReaction(code)))
    throw new ApiError(400, 'أحد الرياكشنات المحددة غير موجود.');
  const exists = db.prepare('SELECT 1 FROM collections WHERE slug=?').get(input.slug);
  if (edit && !exists) throw new ApiError(404, 'المجموعة غير موجودة.');
  if (!edit && exists) throw new ApiError(409, 'رابط المجموعة مستخدم مسبقًا.');
  db.transaction(() => {
    if (edit) {
      db.prepare(
        'UPDATE collections SET title=?,description=?,cover_code=?,active=?,kind=? WHERE slug=?',
      ).run(
        input.title,
        input.description,
        input.coverCode || memberCodes[0] || null,
        Number(input.active),
        input.kind,
        input.slug,
      );
    } else {
      db.prepare(
        'INSERT INTO collections(slug,title,description,cover_code,active,created_at,kind) VALUES (?,?,?,?,?,?,?)',
      ).run(
        input.slug,
        input.title,
        input.description,
        input.coverCode || memberCodes[0] || null,
        Number(input.active),
        new Date().toISOString(),
        input.kind,
      );
    }
    db.prepare('DELETE FROM collection_items WHERE slug=?').run(input.slug);
    const put = db.prepare('INSERT INTO collection_items(slug,code,position) VALUES (?,?,?)');
    memberCodes.forEach((code, position) => put.run(input.slug, code, position));
  })();
  return listCollections(true).find((collection) => collection.slug === input.slug)!;
}

export function deleteCollection(slug: string) {
  const deleted = db.prepare('DELETE FROM collections WHERE slug=?').run(slug);
  if (!deleted.changes) throw new ApiError(404, 'المجموعة غير موجودة.');
}
