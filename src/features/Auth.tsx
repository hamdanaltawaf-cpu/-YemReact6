'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, ShieldCheck, Bookmark } from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { Qusasa } from '@/components/Qusasa';
export default function Auth() {
  const app = useApp(),
    router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login'),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          name: data.get('name') || undefined,
          email: data.get('email'),
          password: data.get('password'),
        }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      await app.syncUser();
      app.toast(mode === 'register' ? 'أهلًا بك في يمن رياكت!' : 'حيّاك من جديد');
      router.push(body.user.role === 'admin' ? '/admin' : '/saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر الاتصال');
    } finally {
      setBusy(false);
    }
  }
  if (app.user)
    return (
      <section className="container page-section empty-state">
        <ShieldCheck size={50} />
        <h1>حيّاك، {app.user.name}.</h1>
        <p>أنت مسجّل الدخول بالفعل.</p>
        <Link className="btn btn-dark" href={app.user.role === 'admin' ? '/admin' : '/saved'}>
          افتح {app.user.role === 'admin' ? 'الاستوديو' : 'مجموعتك'} <ArrowLeft size={18} />
        </Link>
        <button className="text-button" onClick={app.logout}>
          تسجيل الخروج
        </button>
      </section>
    );
  return (
    <section className="container auth-section">
      <div className="auth-story">
        <Qusasa size={60} tone="paper" />
        <span className="eyebrow">كل ردودك. معك.</span>
        <h1>
          مجموعتك،
          <br />
          وين ما تكون.
        </h1>
        <p>
          سجّل الدخول، وخلي الرد المناسب جاهزًا
          <br />
          من أي جهاز تستخدمه.
        </p>
        <div>
          <Bookmark size={22} />
          <span>بلا متابعين. بلا إعلانات. بلا زحمة.</span>
        </div>
      </div>
      <div className="auth-form-wrap">
        <div className="eyebrow">أهلًا بأهل الردود الحلوة</div>
        <h2>{mode === 'login' ? 'حيّاك من جديد.' : 'خلّها مجموعتك.'}</h2>
        <p className="muted">
          {mode === 'login' ? 'ادخل حسابك، ردودك بانتظارك.' : 'حساب بسيط. عشان ما يضيع منك رد.'}
        </p>
        <div className="segmented">
          <button
            onClick={() => {
              setMode('login');
              setError('');
            }}
            aria-pressed={mode === 'login'}
            className={mode === 'login' ? 'active' : ''}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => {
              setMode('register');
              setError('');
            }}
            aria-pressed={mode === 'register'}
            className={mode === 'register' ? 'active' : ''}
          >
            حساب جديد
          </button>
        </div>
        <form onSubmit={submit} className="stack-form">
          {mode === 'register' && (
            <label>
              اسمك
              <input
                name="name"
                minLength={2}
                maxLength={60}
                required
                autoComplete="name"
                placeholder="إيش نناديك؟"
              />
            </label>
          )}
          <label>
            البريد الإلكتروني
            <input
              name="email"
              type="email"
              maxLength={254}
              required
              autoComplete="email"
              dir="ltr"
              placeholder="you@example.com"
            />
          </label>
          <label>
            كلمة المرور
            <span className="password-field">
              <input
                name="password"
                aria-label="كلمة المرور"
                type={visible ? 'text' : 'password'}
                minLength={10}
                maxLength={128}
                required
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                dir="ltr"
                aria-describedby="password-hint"
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
            <small id="password-hint">
              10 أحرف على الأقل. اختر كلمة مرور غير مستخدمة في مكان آخر.
            </small>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-dark" disabled={busy}>
            {busy ? 'لحظة، نجهّز لك...' : mode === 'login' ? 'ادخل حسابك' : 'إنشاء الحساب'}
            <ArrowLeft size={18} />
          </button>
        </form>
        <p className="auth-disclaimer">
          حساب محلي لهذه النسخة. لا يوجد تسجيل اجتماعي أو تأكيد/استعادة كلمة المرور بالبريد بعد.
        </p>
        <Link href="/library" className="text-button">
          كمّل بدون حساب <ArrowLeft size={15} />
        </Link>
      </div>
    </section>
  );
}
