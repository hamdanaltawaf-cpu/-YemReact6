'use client';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  CircleHelp,
  Clapperboard,
  Download,
  LogOut,
  Monitor,
  Moon,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sun,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import { useApp } from './AppProvider';
import { Modal } from './ui/Modal';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const accents = [
  ['#c1592e', 'كهرماني'],
  ['#367567', 'أخضر'],
] as const;
const themes = [
  ['system', 'تلقائي', Monitor],
  ['light', 'نهاري', Sun],
  ['dark', 'ليلي', Moon],
] as const;

/** الصفحة والنافذة القديمة تشتركان في التفضيلات والوظائف نفسها. */
export function SettingsPanel() {
  const app = useApp();
  const id = useId();
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const helpLink = useRef<HTMLAnchorElement>(null);
  const user = app.authReady && !app.authError ? app.user : null;
  const studioHref =
    user?.role === 'admin'
      ? '/admin'
      : !user && app.authReady && !app.authError
        ? '/login?next=%2Fadmin'
        : null;
  const selectedAccent = accents.find(([color]) => color === app.accent);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const done = await app.logout();
    setSigningOut(false);
    if (done) {
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) helpLink.current?.focus();
      });
    }
  }

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Keep a keyboard-focused setting above the existing fixed mobile navigation.
  // The legacy modal has its own scroll container and must not move the page.
  function keepFocusVisible(event: FocusEvent<HTMLDivElement>) {
    if (window.innerWidth >= 640) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest('dialog')) return;
    requestAnimationFrame(() => {
      if (!target.isConnected || document.activeElement !== target) return;
      const nav = document.querySelector<HTMLElement>('.glass-nav');
      if (!nav || nav.getClientRects().length === 0) return;
      const control = target.getBoundingClientRect();
      const bar = nav.getBoundingClientRect();
      if (
        control.bottom > bar.top - 12 &&
        control.top < bar.bottom &&
        control.right > bar.left &&
        control.left < bar.right
      ) {
        window.scrollBy({ top: Math.ceil(control.bottom - bar.top + 12), behavior: 'auto' });
      }
    });
  }

  return (
    <div className="settings-panel" onFocusCapture={keepFocusVisible}>
      {app.preferencesError && (
        <div className="settings-save-error" role="alert">
          <TriangleAlert size={19} aria-hidden="true" />
          <span>
            تعذّر حفظ بعض التفضيلات في المتصفح. التغييرات مطبّقة الآن، لكنها قد لا تبقى بعد إعادة
            تحميل الصفحة أو إغلاقها. أعد اختيار التفضيل للمحاولة مجددًا.
          </span>
        </div>
      )}

      <section className="settings-card" aria-labelledby={`${id}-display`}>
        <div className="settings-card-intro">
          <span className="settings-section-icon">
            <Settings2 size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id={`${id}-display`}>تفضيلات العرض</h2>
            <p>تُطبّق فورًا وتُحفظ في هذا المتصفح عند توفّر التخزين.</p>
          </div>
        </div>

        <div className="settings-option-section">
          <div className="settings-option-heading">
            <h3 id={`${id}-theme`}>المظهر</h3>
            <p>تلقائي يتبع إعداد الجهاز.</p>
          </div>
          <div className="settings-themes" role="group" aria-labelledby={`${id}-theme`}>
            {themes.map(([value, label, Icon]) => (
              <button
                type="button"
                key={value}
                className="settings-theme-choice"
                aria-pressed={app.theme === value}
                onClick={() => app.setTheme(value)}
              >
                <span className="settings-theme-preview" data-preview={value} aria-hidden="true">
                  <span className="settings-preview-top">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="settings-preview-body">
                    <span className="settings-preview-swatch" />
                    <span className="settings-preview-lines">
                      <i />
                      <i />
                    </span>
                  </span>
                </span>
                <span className="settings-theme-label">
                  <span className="settings-theme-name">
                    <Icon size={16} aria-hidden="true" /> {label}
                  </span>
                  <span className="settings-choice-check" aria-hidden="true">
                    <Check size={12} strokeWidth={2.4} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-option-section">
          <div className="settings-option-heading">
            <h3 id={`${id}-accent`}>لون الواجهة</h3>
          </div>
          <div className="settings-color-choices" role="group" aria-labelledby={`${id}-accent`}>
            {accents.map(([color, name]) => (
              <button
                type="button"
                key={color}
                className="settings-color-choice"
                aria-label={name}
                aria-pressed={app.accent === color}
                onClick={() => app.setAccent(color)}
              >
                <span
                  className="settings-color-swatch"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span>{name}</span>
                <span className="settings-choice-check" aria-hidden="true">
                  <Check size={12} strokeWidth={2.4} />
                </span>
              </button>
            ))}
          </div>
          {!selectedAccent && (
            <p className="settings-custom-accent">اللون الحالي: لون مخصص. اختر لونًا لتغييره.</p>
          )}
        </div>

        <div className="settings-option-section">
          <label className="settings-motion-row">
            <span className="settings-motion-copy">
              <strong id={`${id}-motion`}>تخفيف الحركة</strong>
              <small id={`${id}-motion-description`}>قلّل التأثيرات المتحركة لتجربة أهدأ.</small>
            </span>
            <span className="settings-switch-wrap">
              <input
                type="checkbox"
                role="switch"
                aria-labelledby={`${id}-motion`}
                aria-describedby={`${id}-motion-description`}
                checked={app.reduced}
                onChange={(event) => app.setReduced(event.target.checked)}
              />
              <span className="settings-switch-visual" aria-hidden="true" />
            </span>
          </label>
        </div>

        <div className="settings-option-section settings-reset-area">
          <button
            type="button"
            className="settings-reset-button"
            onClick={() => {
              const themeSaved = app.setTheme('system');
              const accentSaved = app.setAccent('#c1592e');
              const motionSaved = app.setReduced(false);
              app.toast(
                themeSaved && accentSaved && motionSaved
                  ? 'رجعنا للإعدادات الأساسية'
                  : 'تعذّر حفظ بعض الإعدادات الأساسية في المتصفح.',
              );
            }}
          >
            <RotateCcw size={17} aria-hidden="true" />
            استعادة تفضيلات العرض
          </button>
          <span className="settings-reset-hint">لا تؤثر على الحساب أو المحفوظات.</span>
        </div>
      </section>

      <section className="settings-secondary" aria-labelledby={`${id}-application`}>
        <h2 id={`${id}-application`}>التطبيق</h2>
        <div className="settings-utility-list">
          <div className={`settings-utility settings-install-row${install ? ' has-install' : ''}`}>
            <span className="settings-utility-icon">
              <Smartphone size={19} aria-hidden="true" />
            </span>
            <div className="settings-utility-copy">
              <strong>تثبيت التطبيق</strong>
              {install ? (
                <p>أضف المكتبة إلى الشاشة الرئيسية.</p>
              ) : (
                <p>
                  إذا دعم المتصفح ذلك، يمكنك إضافة المكتبة من قائمته. قد يختلف التثبيت والعمل دون
                  اتصال حسب المتصفح وإعدادات النشر.
                </p>
              )}
            </div>
            {install && (
              <button
                type="button"
                className="settings-install-button"
                onClick={async () => {
                  await install.prompt();
                  const choice = await install.userChoice;
                  if (choice.outcome === 'accepted') setInstall(null);
                }}
              >
                <Download size={17} aria-hidden="true" />
                ثبّت التطبيق
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="settings-utilities">
        <section className="settings-secondary" aria-labelledby={`${id}-help`}>
          <h2 id={`${id}-help`}>المساعدة</h2>
          <div className="settings-utility-list">
            <Link
              ref={helpLink}
              className="settings-utility"
              href="/help"
              aria-label="مركز المساعدة"
            >
              <span className="settings-utility-icon">
                <CircleHelp size={19} aria-hidden="true" />
              </span>
              <span className="settings-utility-copy">
                <strong>مركز المساعدة</strong>
                <small>إجابات عن التصفح والحساب والمساهمة.</small>
              </span>
              <ArrowLeft className="settings-utility-arrow" size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="settings-secondary" aria-labelledby={`${id}-account`}>
          <h2 id={`${id}-account`}>الحساب</h2>
          <div className="settings-utility-list">
            {studioHref ? (
              <Link className="settings-utility" href={studioHref} aria-label="دخول الاستديو">
                <span className="settings-utility-icon">
                  <Clapperboard size={19} aria-hidden="true" />
                </span>
                <span className="settings-utility-copy">
                  <strong>{user?.role === 'admin' ? 'الاستديو' : 'دخول الاستديو'}</strong>
                  <small>
                    {user?.role === 'admin'
                      ? 'إدارة مكتبة يمن رياكت والمساهمات.'
                      : 'سجّل الدخول بحساب مالك المكتبة للوصول إلى أدوات الإدارة.'}
                  </small>
                </span>
                <ArrowLeft className="settings-utility-arrow" size={17} aria-hidden="true" />
              </Link>
            ) : (
              <div className="settings-utility settings-studio-unavailable" aria-disabled="true">
                <span className="settings-utility-icon">
                  <Clapperboard size={19} aria-hidden="true" />
                </span>
                <span className="settings-utility-copy">
                  <strong>الاستديو</strong>
                  <small>
                    {app.authError
                      ? 'تعذّر التحقق من الحساب.'
                      : app.authReady
                        ? 'يتطلب الدخول بحساب مالك المكتبة.'
                        : 'جارٍ التحقق من الحساب…'}
                  </small>
                </span>
              </div>
            )}
            {user && (
              <button
                type="button"
                className="settings-utility settings-signout"
                disabled={signingOut}
                onClick={() => void signOut()}
              >
                <span className="settings-utility-icon">
                  <LogOut size={19} aria-hidden="true" />
                </span>
                <span className="settings-utility-copy">
                  <strong>{signingOut ? 'جارٍ تسجيل الخروج…' : 'تسجيل الخروج'}</strong>
                </span>
              </button>
            )}
            {app.authError ? (
              <div className="settings-utility settings-session-status" role="alert">
                <span className="settings-utility-icon">
                  <TriangleAlert size={19} aria-hidden="true" />
                </span>
                <span className="settings-utility-copy">
                  <strong>تعذّر التحقق من الحساب.</strong>
                  <small>حاول مجددًا للتحقق من الجلسة.</small>
                </span>
                <button type="button" onClick={() => void app.syncUser()}>
                  إعادة المحاولة
                </button>
              </div>
            ) : !app.authReady ? (
              <div className="settings-utility settings-session-status" role="status">
                <span className="settings-utility-icon">
                  <ShieldCheck size={19} aria-hidden="true" />
                </span>
                <span className="settings-utility-copy">
                  <strong>جارٍ التحقق من الحساب…</strong>
                </span>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

/** النافذة القديمة باقية للتوافق؛ الواجهة تفتح صفحة /settings المستقلة. */
export function Settings() {
  const app = useApp();
  return (
    <Modal open={app.settings} onClose={() => app.setSettings(false)} title="على ذوقك">
      <SettingsPanel />
    </Modal>
  );
}
