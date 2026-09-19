import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { db, audit } from '@/server/db';
import {
  currentUser,
  hashPassword,
  checkPassword,
  createSession,
  digest,
  sameOrigin,
  rateLimit,
  apiError,
  ApiError,
} from '@/server/auth';
export const runtime = 'nodejs';
export async function GET() {
  return Response.json({ user: await currentUser() }, { headers: { 'Cache-Control': 'no-store' } });
}
const schema = z.object({
  mode: z.enum(['login', 'register']),
  name: z.string().trim().min(2).max(60).optional(),
  email: z
    .string()
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(10).max(128),
});
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    rateLimit(req, 'auth', 12);
    const input = schema.parse(await req.json());
    let user = db.prepare('SELECT * FROM users WHERE email=?').get(input.email) as
      { id: string; password_hash: string } | undefined;
    if (input.mode === 'register') {
      if (!input.name) throw new ApiError(400, 'اكتب اسمًا من حرفين على الأقل.');
      if (user) throw new ApiError(409, 'لا يمكن إنشاء الحساب بهذا البريد. جرّب تسجيل الدخول.');
      const id = randomUUID();
      const hash = await hashPassword(input.password);
      db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(
        id,
        input.name,
        input.email,
        hash,
        'member',
        new Date().toISOString(),
      );
      user = { id, password_hash: hash };
      audit(id, 'register', 'إنشاء حساب');
    } else {
      // Always hash a candidate to reduce account-enumeration timing differences.
      const hash = user?.password_hash || (await hashPassword('invalid-account-password'));
      if (!(await checkPassword(input.password, hash)) || !user)
        throw new ApiError(401, 'البريد أو كلمة المرور غير صحيحة.');
    }
    await createSession(user.id);
    return Response.json({ user: await currentUser() });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const c = await cookies();
    const token = c.get('yr_session')?.value;
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
    c.delete('yr_session');
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
