import { z } from 'zod';
import { listCollections, saveCollection, deleteCollection } from '@/server/collections';
import { requireAdmin, sameOrigin, rateLimit, apiError } from '@/server/auth';
import { audit } from '@/server/db';
export const runtime = 'nodejs';
const schema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(64),
  kind: z.enum(['thematic', 'person', 'place']).default('thematic'),
  title: z.string().trim().min(1).max(70),
  description: z.string().trim().max(300).default(''),
  coverCode: z
    .string()
    .regex(/^YR-[A-Z0-9-]{4,32}$/)
    .nullable()
    .default(null),
  memberCodes: z.array(z.string().regex(/^YR-[A-Z0-9-]{4,32}$/)).max(100),
  active: z.boolean(),
});
export async function GET(req: Request) {
  try {
    const admin = new URL(req.url).searchParams.get('scope') === 'admin';
    if (admin) await requireAdmin();
    return Response.json(
      { collections: listCollections(admin) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
async function persist(req: Request, edit: boolean) {
  try {
    sameOrigin(req);
    const user = await requireAdmin();
    rateLimit(req, 'collection', 30);
    const input = schema.parse(await req.json());
    const collection = saveCollection(input, edit);
    audit(user.id, edit ? 'collection-update' : 'collection-create', collection.slug);
    return Response.json({ collection });
  } catch (e) {
    return apiError(e);
  }
}
export const POST = (req: Request) => persist(req, false);
export const PUT = (req: Request) => persist(req, true);
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const user = await requireAdmin();
    rateLimit(req, 'collection', 30);
    const { slug } = schema.pick({ slug: true }).parse(await req.json());
    deleteCollection(slug);
    audit(user.id, 'collection-delete', slug);
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
