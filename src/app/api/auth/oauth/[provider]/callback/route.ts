import { completeOAuth } from '@/server/oauth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, context: { params: Promise<{ provider: string }> }) {
  return completeOAuth(req, (await context.params).provider);
}
export const POST = GET;
