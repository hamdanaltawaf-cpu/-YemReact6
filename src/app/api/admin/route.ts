import { db } from '@/server/db';
import { requireAdmin, apiError } from '@/server/auth';
export async function GET() {
  try {
    await requireAdmin();
    return Response.json(
      {
        users: db
          .prepare(
            'SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT 100',
          )
          .all(),
        events: db.prepare('SELECT kind,COUNT(*) as count FROM events GROUP BY kind').all(),
        daily: db
          .prepare(
            'SELECT substr(created_at,1,10) as day,COUNT(*) as count FROM events WHERE created_at>=? GROUP BY day ORDER BY day',
          )
          .all(new Date(Date.now() - 7 * 864e5).toISOString()),
        audit: db
          .prepare('SELECT action,detail,created_at FROM audit ORDER BY id DESC LIMIT 40')
          .all(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
