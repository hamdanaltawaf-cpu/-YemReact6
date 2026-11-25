'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookmarkMinus,
  Clock3,
  LogIn,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import { useApp } from './AppProvider';
import { AccountContributions } from './AccountContributions';
import { AccountEmptyArt } from './AccountEmptyArt';
import { savedReactions } from '@/lib/saved';
import type { SocialProvider } from '@/lib/social';

type AccountTab = 'saved' | 'contributions';
type UndoSave = { code: string; caption: string; scope: string };

/** A private, self-service account surface for the verified user or the current guest. */
export function AccountSurface({
  googleAuthOrigin = '',
  readyProviders = [],
  onNavigate = () => {},
  initialTab = 'saved',
}: {
  googleAuthOrigin?: string;
  readyProviders?: readonly SocialProvider[];
  onNavigate?: () => void;
  initialTab?: AccountTab;
}) {
  const app = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: AccountTab =
    requestedTab === 'saved' || requestedTab === 'contributions' ? requestedTab : initialTab;
  const owner = app.authReady && !app.authError && !!app.user;

  const savedItems = savedReactions(app.reactions, app.saved);
  const googleReady = readyProviders.includes('google') && !!googleAuthOrigin;
  const scope = app.user?.id || 'guest';
  const scopeRef = useRef(scope);
  const undoButton = useRef<HTMLButtonElement>(null);
  scopeRef.current = scope;
  const [undo, setUndo] = useState<UndoSave | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setUndo(null);
    setBusyCode(null);
    setActionError('');
  }, [scope]);
  useEffect(() => {
    // If removing a focused row displaced focus, offer its undo without stealing focus elsewhere.
    if (undo && document.activeElement === document.body) undoButton.current?.focus();
  }, [undo]);
  function selectTab(next: AccountTab) {
    if (next === tab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function tabsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 'saved'
        : event.key === 'End'
          ? 'contributions'
          : tab === 'saved'
            ? 'contributions'
            : 'saved';
    selectTab(next);
    requestAnimationFrame(() =>
      document
        .getElementById(next === 'saved' ? 'account-tab-saved' : 'account-tab-contributions')
        ?.focus(),
    );
  }

  async function removeSaved(code: string, caption: string) {
    if (busyCode) return;
    const requestScope = scope;
    setActionError('');
    setBusyCode(code);
    const removed = await app.toggleSave(code, { silent: true, saved: false });
    if (scopeRef.current !== requestScope) return;
    setBusyCode(null);
    if (removed) setUndo({ code, caption, scope: requestScope });
    else setActionError('تعذّرت إزالة المحفوظ. تحقق من الاتصال وحاول مجددًا.');
  }

  async function restoreSaved() {
    if (!undo || busyCode || undo.scope !== scope) return;
    if (app.saved.includes(undo.code)) {
      setUndo(null);
      return;
    }
    const requestScope = scope;
    setActionError('');
    setBusyCode(undo.code);
    const restored = await app.toggleSave(undo.code, { silent: true, saved: true });
    if (scopeRef.current !== requestScope) return;
    setBusyCode(null);
    if (restored) {
      const restoredCode = undo.code;
      setUndo(null);
      requestAnimationFrame(() => {
        if (document.activeElement !== document.body) return;
        const row = Array.from(document.querySelectorAll<HTMLElement>('[data-saved-code]')).find(
          (element) => element.dataset.savedCode === restoredCode,
        );
        row?.querySelector<HTMLButtonElement>('.account-remove-save')?.focus();
      });
    } else setActionError('تعذّرت استعادة المحفوظ. حاول مرة أخرى.');
  }

  const signInEntry = (
    <Link href="/login" className="account-signin" onClick={onNavigate}>
      <LogIn size={18} aria-hidden="true" /> تسجيل الدخول
    </Link>
  );

  return (
    <div className="account-surface">
      <div className="account-profile-card">
        {app.authError ? (
          <div className="account-identity account-identity-error" role="alert">
            <span className="account-profile-avatar" aria-hidden="true">
              <UserRound size={20} />
            </span>
            <div className="account-identity-copy">
              <strong>تعذّر التحقق من الحساب</strong>
              <p className="account-identity-note">تحقق من الاتصال ثم حاول مجددًا.</p>
            </div>
          </div>
        ) : !app.authReady ? (
          <div className="account-identity" role="status">
            <span className="account-profile-avatar" aria-hidden="true">
              <UserRound size={20} />
            </span>
            <div className="account-identity-copy">
              <strong>جارٍ التحقق من الحساب…</strong>
              <p className="account-identity-note">لحظة واحدة.</p>
            </div>
          </div>
        ) : app.user ? (
          <div className="account-identity">
            <span className="account-profile-avatar" aria-hidden="true">
              {app.user.name.trim().slice(0, 1) || <UserRound size={20} />}
            </span>
            <div className="account-identity-copy">
              <strong>{app.user.name}</strong>
              <p className="account-identity-note">حسابك على يمن رياكت.</p>
            </div>
            {app.user.role === 'admin' && <span className="account-role-badge">مشرف</span>}
          </div>
        ) : (
          <div className="account-identity account-identity-guest">
            <span className="account-profile-avatar" aria-hidden="true">
              <UserRound size={20} />
            </span>
            <div className="account-identity-copy">
              <strong>أنت زائر</strong>
              <p className="account-identity-note">يمكنك التصفح دون حساب.</p>
            </div>
          </div>
        )}

        <div className="account-profile-actions">
          {app.authError && (
            <button type="button" className="account-retry" onClick={() => void app.syncUser()}>
              إعادة المحاولة
            </button>
          )}
          {app.authReady && !app.authError && !app.user && signInEntry}
        </div>
        {app.authReady && !app.authError && !app.user && !googleReady && (
          <p className="account-auth-note">
            خدمة Google غير مهيّأة حاليًا. التصفح والحفظ المحلي متاحان.
          </p>
        )}
      </div>

      <div className="account-content">
        <div
          className="account-tabs"
          role="tablist"
          aria-label="محتوى حسابك"
          onKeyDown={tabsKeyDown}
        >
          <button
            type="button"
            role="tab"
            id="account-tab-saved"
            aria-selected={tab === 'saved'}
            aria-controls="account-tab-panel"
            tabIndex={tab === 'saved' ? 0 : -1}
            onClick={() => selectTab('saved')}
          >
            <Bookmark size={16} aria-hidden="true" />
            المحفوظات
            {app.authReady && !app.authError && app.savedReady && (
              <span className="account-tab-count" aria-label={`${savedItems.length} محفوظات`}>
                {savedItems.length}
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            id="account-tab-contributions"
            aria-selected={tab === 'contributions'}
            aria-controls="account-tab-panel"
            tabIndex={tab === 'contributions' ? 0 : -1}
            onClick={() => selectTab('contributions')}
          >
            <Send size={16} aria-hidden="true" />
            مساهماتي
          </button>
        </div>

        <div
          className="account-panel"
          role="tabpanel"
          id="account-tab-panel"
          aria-labelledby={tab === 'saved' ? 'account-tab-saved' : 'account-tab-contributions'}
          tabIndex={0}
        >
          {tab === 'saved' && app.authReady && !app.authError && app.savedReady && (
            <div className="account-storage-status" role="status">
              <Bookmark size={16} aria-hidden="true" />
              <span>
                مصدر المحفوظات المعروضة: <strong>{app.user ? 'حسابك' : 'هذا الجهاز'}</strong>
              </span>
            </div>
          )}
          {tab === 'saved' &&
            app.authReady &&
            !app.authError &&
            app.savedReady &&
            savedItems.length > 0 && (
              <div className="account-panel-toolbar">
                <Link className="account-panel-link" href="/library" onClick={onNavigate}>
                  تصفح المكتبة <ArrowLeft size={16} aria-hidden="true" />
                </Link>
              </div>
            )}

          {app.authError ? (
            <div className="account-empty account-error" role="alert">
              <strong>تعذّر التحقق من الحساب.</strong>
              <p>لم نتمكن من معرفة حالة الدخول. تحقق من الاتصال وحاول مجددًا.</p>
              <button type="button" className="account-retry" onClick={() => void app.syncUser()}>
                إعادة المحاولة
              </button>
            </div>
          ) : !app.authReady ? (
            <div className="account-empty account-loading" role="status">
              <span className="account-state-heading">
                <Clock3 size={19} aria-hidden="true" /> جارٍ التحقق من الحساب…
              </span>
              <p>لن نعرض المحفوظات حتى تتضح حالة الحساب.</p>
            </div>
          ) : tab === 'saved' ? (
            <>
              {app.savedError && (
                <div className="account-sync-warning" role="alert">
                  <p>
                    {app.user
                      ? app.savedError
                      : 'تعذّرت قراءة المحفوظات المحلية. تحقق من تخزين المتصفح ثم حاول مجددًا.'}
                  </p>
                  <button
                    type="button"
                    className="account-retry"
                    onClick={() => void app.syncUser()}
                  >
                    إعادة المحاولة
                  </button>
                </div>
              )}
              {actionError && (
                <p className="account-action-error" role="alert">
                  {actionError}
                </p>
              )}
              {undo && undo.scope === scope && (
                <div className="account-undo" role="status" aria-live="polite">
                  <span>أُزيل «{undo.caption}» من المحفوظات.</span>
                  <button
                    ref={undoButton}
                    type="button"
                    disabled={!!busyCode}
                    onClick={() => void restoreSaved()}
                  >
                    {busyCode === undo.code ? 'جارٍ الاستعادة…' : 'تراجع'}
                  </button>
                  <button
                    type="button"
                    className="account-undo-close"
                    aria-label="إغلاق رسالة التراجع"
                    onClick={() => setUndo(null)}
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </div>
              )}
              {!app.savedReady ? (
                app.savedError ? (
                  <div className="account-empty account-error">
                    <strong>المحفوظات غير متاحة الآن.</strong>
                    <p>يمكنك إعادة المحاولة من التنبيه أعلاه.</p>
                  </div>
                ) : (
                  <div className="account-empty account-loading" role="status">
                    <span className="account-state-heading">
                      <Clock3 size={19} aria-hidden="true" /> جارٍ تحميل المحفوظات…
                    </span>
                    <p>يرجى الانتظار حتى يكتمل التحميل.</p>
                  </div>
                )
              ) : savedItems.length ? (
                <ul className="account-row-list">
                  {savedItems.map((item) => (
                    <li className="account-saved-item" key={item.code} data-saved-code={item.code}>
                      <Link
                        className="account-row"
                        href={`/r/${encodeURIComponent(item.code)}`}
                        onClick={() => {
                          onNavigate();
                        }}
                        aria-label={`تفاصيل ${item.caption}`}
                      >
                        <span className="account-row-media">
                          <img src={item.poster} alt="" loading="lazy" />
                        </span>
                        <span className="account-row-copy">
                          <b>{item.caption}</b>
                          <small>{item.isDemo ? 'نموذج تجريبي' : 'من محفوظاتك'}</small>
                        </span>
                        <ArrowLeft className="account-row-arrow" size={17} aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        className="account-remove-save"
                        title="إزالة من المحفوظات"
                        aria-label={`إزالة ${item.caption} من المحفوظات`}
                        disabled={!!busyCode}
                        onClick={() => void removeSaved(item.code, item.caption)}
                      >
                        <BookmarkMinus size={19} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="account-empty account-empty-feature">
                  <div className="account-empty-copy">
                    <span className="account-empty-kicker">ابدأ بجمع لقطاتك</span>
                    <strong>
                      {app.user ? 'لا محفوظات في الحساب بعد.' : 'ما عندك محفوظات محلية بعد.'}
                    </strong>
                    <p>إذا أعجبك رياكشن، احفظه من المكتبة وستجده هنا وقت ما تحتاجه.</p>
                    <Link className="btn btn-dark" href="/library" onClick={onNavigate}>
                      تصفح المكتبة <ArrowLeft size={16} aria-hidden="true" />
                    </Link>
                  </div>
                  <AccountEmptyArt kind="saved" />
                </div>
              )}
            </>
          ) : !owner ? (
            <div className="account-empty account-empty-feature">
              <div className="account-empty-copy">
                <span className="account-empty-kicker">عندك لقطة تستاهل؟</span>
                <strong>مساهماتك تبدأ من هنا.</strong>
                <p>يمكنك تجهيز رياكشن في التجربة المحلية؛ لن يُرفع الملف أو يُنشر فعليًا.</p>
                <Link className="btn btn-dark" href="/contribute" onClick={onNavigate}>
                  جهّز رياكشن <ArrowLeft size={16} aria-hidden="true" />
                </Link>
              </div>
              <AccountEmptyArt kind="contributions" />
            </div>
          ) : (
            <AccountContributions />
          )}
        </div>
      </div>
    </div>
  );
}
