import { notFound } from 'next/navigation';
import { findReaction } from '@/server/db';
import Detail from '@/features/Detail';
import { collectionsForReaction } from '@/server/collections';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = findReaction(code);
  if (!r) notFound();
  return {
    title: r.caption,
    description: r.situation || r.caption,
    alternates: { canonical: `/r/${code}` },
    openGraph: { title: r.caption, description: r.situation || r.caption, images: [r.poster] },
  };
}
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = findReaction(code);
  if (!r) notFound();
  return <Detail reaction={r} collections={collectionsForReaction(r.code)} />;
}
