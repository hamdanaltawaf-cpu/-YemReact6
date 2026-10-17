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
        <span className="eyebrow">تفضيلاتك</span>
        <h1 id="settings-title">الإعدادات</h1>
        <p>المكتبة نفسها. الجوّ اللي يناسبك — تُحفظ على جهازك دون أي تسجيل.</p>
      </div>
      <SettingsPanel />
    </section>
  );
}
