import { beginOAuth } from '@/server/oauth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, context: { params: Promise<{ provider: string }> }) {
  return beginOAuth(req, (await context.params).provider);
}
