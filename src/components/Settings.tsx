'use client';
import { Monitor, Sun, Moon, Check, Download, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from './AppProvider';
import { Modal } from './ui/Modal';
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function Settings() {
  const app = useApp();
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  return (
    <Modal open={app.settings} onClose={() => app.setSettings(false)} title="على ذوقك">
      <p className="muted">المكتبة نفسها. الجوّ اللي يناسبك.</p>
      <div className="settings-group">
        <h3>المظهر</h3>
        <div className="segmented">
          {[
            ['system', 'تلقائي', Monitor],
            ['light', 'نهاري', Sun],
            ['dark', 'ليلي', Moon],
          ].map(([v, label, Icon]) => {
            const I = Icon as typeof Sun;
            return (
              <button
                key={String(v)}
                aria-pressed={app.theme === v}
                className={app.theme === v ? 'active' : ''}
                onClick={() => app.setTheme(String(v))}
              >
                <I size={18} />
                {String(label)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="settings-group">
        <h3>لونك المفضّل</h3>
        <div className="swatches">
          {[
            ['#c1592e', 'كهرماني'],
            ['#367567', 'أخضر'],
            ['#6863ac', 'بنفسجي'],
          ].map(([color, name]) => (
            <button
              key={color}
              style={{ background: color }}
              aria-label={name}
              aria-pressed={app.accent === color}
              onClick={() => app.setAccent(color)}
            >
              {app.accent === color && <Check size={20} />}
            </button>
          ))}
        </div>
        <small className="muted">ألوان مختارة للحفاظ على وضوح الواجهة.</small>
      </div>
      <label className="toggle-row">
        <span>
          <b>تخفيف الحركة</b>
          <small>تجربة أهدأ، بدون تأثيرات مستمرة.</small>
        </span>
        <input
          type="checkbox"
          checked={app.reduced}
          onChange={(e) => app.setReduced(e.target.checked)}
        />
      </label>
      <div className="settings-group">
        <h3>المكتبة معك</h3>
        {install ? (
          <button
            className="btn btn-dark"
            onClick={async () => {
              await install.prompt();
              const choice = await install.userChoice;
              if (choice.outcome === 'accepted') setInstall(null);
            }}
          >
            <Download size={18} />
            ثبّت التطبيق
          </button>
        ) : (
          <p className="muted text-small">
            عندما يدعم متصفحك التثبيت، اختر «إضافة إلى الشاشة الرئيسية» من قائمته. التثبيت والعمل
            دون اتصال متاحان في نسخة الإنتاج.
          </p>
        )}
      </div>
      <button
        className="text-button"
        onClick={() => {
          app.setTheme('system');
          app.setAccent('#c1592e');
          app.setReduced(false);
          app.toast('رجعنا للإعدادات الأساسية');
        }}
      >
        <RotateCcw size={15} />
        استعادة الإعدادات
      </button>
    </Modal>
  );
}
