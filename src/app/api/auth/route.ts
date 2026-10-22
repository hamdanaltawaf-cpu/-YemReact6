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

/* الدفعة 3: PATCH (تحديث اسم العرض) أُزيل نهائيًّا بعد ذهاب مستهلكه الوحيد
   (واجهة تحرير الهوية). غياب التصدير يجعل Next يرد 405 على أي طلب PATCH —
   لا طريق بعد اليوم لتغيير اسم، والأسماء والسجلات القائمة كما هي دون مساس. */
