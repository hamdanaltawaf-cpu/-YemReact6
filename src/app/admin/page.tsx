import Admin from '@/features/Admin';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/server/auth';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'الاستوديو — إدارة المكتبة',
  robots: { index: false, follow: false },
};
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin') notFound();
  return <Admin />;
}
