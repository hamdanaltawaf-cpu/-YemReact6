import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { currentUser, digest, sameOrigin, apiError } from '@/server/auth';
export const runtime = 'nodejs';
export async function GET() {
  return Response.json({ user: await currentUser() }, { headers: { 'Cache-Control': 'no-store' } });
}
/** Password-based registration and login have been retired, not just hidden. */
export async function POST() {
  return Response.json(
    { error: 'الدخول متاح فقط باستخدام Google أو Apple أو Microsoft.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
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

/** تحديث اسم العرض داخل YemReact وحده — لا يمس بريدًا ولا هوية خدمة الدخول. */
const DISPLAY_NAME = /^[^\u0000-\u001f\u007f]{2,40}$/u;
const NO_STORE = { 'Cache-Control': 'no-store' } as const;
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const user = await currentUser();
    if (!user)
      return Response.json(
        { error: 'يلزم تسجيل الدخول لتحديث اسم العرض.' },
        { status: 401, headers: NO_STORE },
      );
    const body = await req.json().catch(() => null);
    const name =
      typeof body?.name === 'string' ? body.name.normalize('NFC').replace(/\s+/g, ' ').trim() : '';
    if (!DISPLAY_NAME.test(name))
      return Response.json(
        { error: 'اسم العرض من حرفين إلى 40 حرفًا، بلا رموز تحكم.' },
        { status: 400, headers: NO_STORE },
      );
    db.prepare('UPDATE users SET name=? WHERE id=?').run(name, user.id);
    db.prepare('INSERT INTO audit(user_id,action,detail,created_at) VALUES (?,?,?,?)').run(
      user.id,
      'profile.rename',
      name,
      new Date().toISOString(),
    );
    return Response.json({ user: { ...user, name } }, { headers: NO_STORE });
  } catch (e) {
    return apiError(e);
  }
}
