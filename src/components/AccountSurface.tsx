'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ArrowLeft,
  CircleHelp,
  Clapperboard,
  FileImage,
  FileVideo2,
  LogOut,
  Pencil,
  Send,
  Settings2,
  UserRound,
} from 'lucide-react';
import { useApp } from './AppProvider';
import { useContribution } from './ContributionProvider';
import { SocialIcon } from './SocialIcon';
import { savedReactions } from '@/lib/saved';
import type { SocialProvider } from '@/lib/social';

/**
 * صفحة الحساب كاملة (يفتحها تبويب «الحساب» من الشريط السفلي على الهاتف) — الترتيب
 * من الأعلى للأسفل: الهوية ← ملخّص النشاط (للجلسة المسجَّلة الحقيقية فقط) ←
 * «إرسال رياكشن»/«الإعدادات» مباشرة ← مبدّل واحد (المحفوظات / مساهماتي).
 * بريد Google لا يُعرض هنا إطلاقًا — لا للزائر ولا لصاحب الحساب. لا ملفات عامة
 * ولا إحصاءات اجتماعية — مكتبة لا شبكة.
 *
 * تعريف «صاحب الحساب» هنا صارم: جلسة التطبيق المسجَّلة app.user فقط. الزائر
 * وجلسة تجربة contribution (mockSignedIn) ليسا حسابًا مسجَّلًا ولا صاحبَ
 * بيانات: بلا عدّادات ولا سجلات مساهمات ولا حالات — تعاملهما الصفحة كزائر.
 */
const STATUS_TEXT = { pending: 'قيد المراجعة', approved: 'مقبولة', rejected: 'مرفوضة' } as const;

export function AccountSurface({
  googleAuthOrigin = '',
  readyProviders = [],
  onNavigate = () => {},
}: {
  /** يقررا على الخادم حصرًا — كما في قائمة الحساب على الحاسوب. */
  googleAuthOrigin?: string;
  readyProviders?: readonly SocialProvider[];
  /** اختياري: انتقال داخلي إضافي قبل المتابعة (يتوفر مسبقًا كـ() => {}). */
  onNavigate?: () => void;
}) {
  const app = useApp();
  const contribution = useContribution();
  /* «المالك»= الجلسة المسجَّلة الحقيقية فقط؛ لا تعامل جلسة التجربة كحساب له بيانات. */
  const owner = !!app.user;
  const [tab, setTab] = useState<'saved' | 'contributions'>('saved');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(app.user?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const savedItems = savedReactions(app.reactions, app.saved);
  /* عدّاد «المساهمات المنشورة» مؤجّل (بلاغ قرار حمدان 2026-10-18): لا يوجد مسار
     نشر فعلي لمساهمات المستخدمين اليوم، و«مقبولة» لا تثبت «منشورة» — لذلك أُخفيت
     بطاقة رقم المساهمات من الملخّص كليًّا (لا إجمالي السجلات بدلًا عنها ولا بطاقة
     فارغة). يعود طرفًا صادقًا عندما يتوفر مصدرٌ موثوق للنشر. */

  function selectTab(next: 'saved' | 'contributions') {
    setTab(next);
    requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({
        behavior: app.reduced ? 'auto' : 'smooth',
        block: 'start',
      }),
    );
  }
  const googleReady = readyProviders.includes('google') && !!googleAuthOrigin;
  const signInEntry = (className: string) =>
    googleReady ? (
      <a className={className} href={`${googleAuthOrigin}/api/auth/oauth/google`}>
        <SocialIcon provider="google" /> تسجيل الدخول بـ Google
      </a>
    ) : (
      /* نفس عقد القائمة بحذافيره: دخول قيد التجهيز لا يفضي إلى رابط OAuth ميت إطلاقًا */
      <Link
        href="/login"
        className="account-google-action account-google-pending"
        onClick={onNavigate}
      >
        <SocialIcon provider="google" /> تسجيل الدخول
        <span className="account-pending-chip">قيد التجهيز</span>
      </Link>
    );

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const cleaned = name.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2 || cleaned.length > 40) {
      setError('اسم العرض من حرفين إلى 40 حرفًا.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleaned }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'تعذّر حفظ الاسم. تحقّق من الاتصال ثم حاول مجددًا.');
      }
      // آلية المزامنة الموجودة: إعادة قراءة الجلسة من الخادم تجلب اسم العرض الجديد
      await app.syncUser();
      app.toast('تم حفظ اسم العرض.');
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'تعذّر حفظ الاسم.');
    } finally {
      setSaving(false);
    }
  }
  function cancelEdit() {
    setName(app.user?.name || '');
    setError('');
    setEditing(false);
  }

  function tabsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = tab === 'saved' ? 'contributions' : 'saved';
    setTab(next);
    requestAnimationFrame(() =>
      document
        .getElementById(next === 'saved' ? 'account-tab-saved' : 'account-tab-contributions')
        ?.focus(),
    );
  }

  return (
    <section className="account-surface" aria-label="صفحة الحساب">
      {/* ١ — الهوية */}
      {app.user ? (
        editing ? (
          <form className="account-identity account-identity-editing" onSubmit={saveName}>
            <span className="account-profile-avatar" aria-hidden="true">
              {app.user.name.trim().slice(0, 1) || <UserRound size={18} />}
            </span>
            <div className="account-identity-copy">
              <label className="account-edit-field">
                اسم العرض
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={40}
                  autoFocus
                  required
                  dir="auto"
                />
                <small>خاص بـ YemReact وحده؛ لا يُزامَن مع اسم حساب خدمة الدخول ولا يغيّره.</small>
              </label>
              <div className="account-edit-actions">
                <button className="btn btn-dark" type="submit" disabled={saving}>
                  {saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
                </button>
                <button className="btn" type="button" onClick={cancelEdit} disabled={saving}>
                  إلغاء
                </button>
              </div>
              {error && (
                <p className="account-edit-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          </form>
        ) : (
          <div className="account-identity">
            <span className="account-profile-avatar" aria-hidden="true">
              {app.user.name.trim().slice(0, 1) || <UserRound size={18} />}
            </span>
            <div className="account-identity-copy">
              <strong>{app.user.name}</strong>
              <small>حسابك على يمن رياكت؛ لا يُعرض بريدُك هنا.</small>
            </div>
            {app.user.role === 'admin' && <span className="account-role-badge">ADMIN</span>}
            <button
              type="button"
              className="text-button account-edit-open"
              onClick={() => setEditing(true)}
            >
              <Pencil size={15} aria-hidden="true" /> تحرير الهوية
            </button>
          </div>
        )
      ) : (
        <div className="account-identity account-identity-guest">
          <UserRound size={22} aria-hidden="true" />
          <div className="account-identity-copy">
            <strong>أنت زائر</strong>
            <p className="account-identity-note">
              سجّل دخولك لحفظ رياكشناتك على حسابك والوصول إليها من أي جهاز.
            </p>
          </div>
          {signInEntry('btn btn-dark account-signin')}
        </div>
      )}

      {/* ٢ — ملخّص النشاط: بطاقة المحفوظات وحدها للمسجَّل الحقيقي فقط (بطاقة
             المساهمات مخفية مؤقتًا لحين مصدر «منشور» موثوق — لا بطاقات فارغة) */}
      {owner && (
        <div className="account-summary" aria-label="ملخص نشاطك">
          <button
            type="button"
            className="account-summary-card"
            data-active={tab === 'saved'}
            onClick={() => selectTab('saved')}
          >
            <b>{savedItems.length}</b>
            <span>المحفوظات</span>
          </button>
        </div>
      )}

      {/* ٣ — الإجراءان المباشران على الهاتف: نشرٌ وإعدادات بلا قوائم وسيطة */}
      <div className="account-actions-row">
        <Link className="btn btn-dark" href="/contribute" onClick={onNavigate}>
          <Send size={16} aria-hidden="true" /> إرسال رياكشن
        </Link>
        <Link className="btn" href="/settings" onClick={onNavigate}>
          <Settings2 size={16} aria-hidden="true" /> الإعدادات
        </Link>
      </div>

      {/* ٤ — مبدّل واحد بقسمين، وتحته محتوى المختار */}
      <div className="account-tabs" role="tablist" aria-label="محتوى حسابك" onKeyDown={tabsKeyDown}>
        <button
          type="button"
          role="tab"
          id="account-tab-saved"
          aria-selected={tab === 'saved'}
          aria-controls="account-tab-panel"
          onClick={() => selectTab('saved')}
        >
          المحفوظات
        </button>
        <button
          type="button"
          role="tab"
          id="account-tab-contributions"
          aria-selected={tab === 'contributions'}
          aria-controls="account-tab-panel"
          onClick={() => selectTab('contributions')}
        >
          مساهماتي
        </button>
      </div>
      <div
        className="account-panel"
        role="tabpanel"
        id="account-tab-panel"
        ref={panelRef}
        aria-labelledby={tab === 'saved' ? 'account-tab-saved' : 'account-tab-contributions'}
      >
        {tab === 'saved' ? (
          savedItems.length ? (
            <ul className="account-row-list">
              {savedItems.map((item) => (
                <li key={item.code}>
                  <button
                    type="button"
                    className="account-row"
                    onClick={() => {
                      onNavigate();
                      app.setPreview(item.code);
                    }}
                    aria-label={`معاينة ${item.caption}`}
                  >
                    <img src={item.poster} alt="" loading="lazy" />
                    <span className="account-row-copy">
                      <b>{item.caption}</b>
                      <small>{item.situation || 'من محفوظاتك'}</small>
                    </span>
                    <ArrowLeft size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="account-empty">
              <strong>{app.user ? 'لا محفوظات بعد.' : 'ما عندك محفوظات محلية بعد.'}</strong>
              <p>من المكتبة، زر «حفظ» على أي رياكشن يُبقيه هنا وقت ما تحتاجه.</p>
              <Link className="btn btn-dark" href="/library" onClick={onNavigate}>
                <ArrowLeft size={16} aria-hidden="true" /> تصفح المكتبة
              </Link>
            </div>
          )
        ) : !owner ? (
          <div className="account-empty">
            <strong>إرسال المساهمات ومتابعتها يتطلب تسجيل الدخول.</strong>
            <p>سجّل أو ابقَ زائرًا للتصفح — المكتبة كاملة لك كما هي.</p>
            {signInEntry('btn btn-dark account-signin')}
          </div>
        ) : contribution.records.length ? (
          <ul className="account-row-list">
            {contribution.records.map((record) => (
              <li key={record.id}>
                <Link className="account-row" href="/account/submissions" onClick={onNavigate}>
                  {record.kind === 'video' ? (
                    <FileVideo2 size={20} aria-hidden="true" />
                  ) : (
                    <FileImage size={20} aria-hidden="true" />
                  )}
                  <span className="account-row-copy">
                    <b>{record.title}</b>
                    <small>{record.createdAt}</small>
                  </span>
                  <span className={`account-status account-status-${record.status}`}>
                    {STATUS_TEXT[record.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="account-empty">
            <strong>ما عندك مساهمات حتى الآن</strong>
            <p>ساهم بأول رياكشن في إثراء المكتبة اليمنية.</p>
            <Link className="btn btn-dark" href="/contribute" onClick={onNavigate}>
              <Send size={16} aria-hidden="true" /> إرسال رياكشن
            </Link>
          </div>
        )}
      </div>

      {/* مرافق قائمة الحساب المعتادة تبقى متاحة أسفل السطح بلا مبدّل إضافي */}
      <div className="account-utilities">
        {app.user?.role === 'admin' && (
          <Link href="/admin" onClick={onNavigate}>
            <Clapperboard size={17} aria-hidden="true" /> الاستوديو
          </Link>
        )}
        <Link href="/help" onClick={onNavigate}>
          <CircleHelp size={17} aria-hidden="true" /> المساعدة
        </Link>
        {(app.user || contribution.mockSignedIn) && (
          <button
            type="button"
            className="account-signout"
            onClick={async () => {
              onNavigate();
              if (app.user) {
                if (await app.logout()) contribution.endMockSession();
              } else {
                contribution.endMockSession();
              }
            }}
          >
            <LogOut size={17} aria-hidden="true" />{' '}
            {app.user ? 'تسجيل الخروج' : 'إنهاء جلسة التجربة'}
          </button>
        )}
      </div>
    </section>
  );
}
