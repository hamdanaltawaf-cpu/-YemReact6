import type { Metadata } from 'next';
import ContributeHub from '@/features/ContributeHub';

export const metadata: Metadata = {
  title: 'المساهمة — نموذج تجريبي',
  description: 'مساحة تجريبية لتحضير رياكشن ومتابعة إرسالات وهمية داخل المتصفح فقط.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ContributeHub />;
}
