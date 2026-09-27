import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'إرسالاتي — نموذج تجريبي',
  description: 'معاينة إرسالات مساهمة وهمية محفوظة محليًا؛ ليست رياكشنات منشورة.',
  robots: { index: false, follow: false },
};
export default function SubmissionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
