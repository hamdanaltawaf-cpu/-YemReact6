import type { Metadata } from 'next';
import { SettingsPanel } from '@/components/Settings';

export const metadata: Metadata = { title: 'الإعدادات' };

/**
 * صفحة إعدادات مستقلة — تفضيلات محلية الجهاز نفسها المعروفة من قائمة الإعدادات
 * القديمة، بلا حجز: متاحة للزائر بعد سلوك «الاستمرار كزائر» المعمول به.
 */
export default function SettingsPage() {
  return (
    <section className="container settings-page" aria-labelledby="settings-title">
      <div className="page-head">
        <h1 id="settings-title">الإعدادات</h1>
        <p>خصّص طريقة عرض المكتبة بما يناسبك.</p>
      </div>
      <SettingsPanel />
    </section>
  );
}
