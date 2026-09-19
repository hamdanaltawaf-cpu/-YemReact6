import { notFound } from 'next/navigation';
import { findReaction } from '@/server/db';
import Detail from '@/features/Detail';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = findReaction(code);
  if (!r) notFound();
  return {
    title: r.caption,
    description: r.situation,
    alternates: { canonical: `/r/${code}` },
    openGraph: { title: r.caption, description: r.situation, images: [r.poster] },
  };
}
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = findReaction(code);
  if (!r) notFound();
  return <Detail reaction={r} />;
}
