'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  Film,
  Image as ImageIcon,
  Users,
  ScrollText,
  Plus,
  Pencil,
  Trash2,
  Download,
  ShieldCheck,
  LockKeyhole,
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  Play,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { Modal } from '@/components/ui/Modal';
import { Qusasa } from '@/components/Qusasa';
import type { Reaction } from '@/lib/reactions';
import { CATEGORIES, CAT_BY_ID } from '@/lib/categories';
type Metrics = {
  users: { id: string; name: string; email: string; role: string; created_at: string }[];
  events: { kind: string; count: number }[];
  daily: { day: string; count: number }[];
  audit: { action: string; detail: string; created_at: string }[];
};
const sections = [
  { id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard },
  { id: 'content', label: 'الرياكشنات', icon: Film },
  { id: 'media', label: 'الوسائط', icon: ImageIcon },
  { id: 'users', label: 'المستخدمون', icon: Users },
  { id: 'audit', label: 'سجل العمليات', icon: ScrollText },
];
export default function Admin() {
  const app = useApp(),
    admin = app.user?.role === 'admin';
  const [tab, setTab] = useState('overview'),
    [metrics, setMetrics] = useState<Metrics | null>(null),
    [editor, setEditor] = useState<Reaction | 'new' | null>(null),
    [deleting, setDeleting] = useState<Reaction | null>(null),
    [busy, setBusy] = useState(false),
    [q, setQ] = useState(''),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!admin) return;
    try {
      const r = await fetch('/api/admin');
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      setMetrics(body);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر الاتصال');
    }
  }, [admin]);
  useEffect(() => {
    load();
  }, [load]);
  const count = (kind: string) =>
    metrics ? metrics.events.find((e) => e.kind === kind)?.count || 0 : '—';
  const filtered = app.reactions.filter((r) =>
    [r.caption, r.code, r.situation].join(' ').includes(q),
  );
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      const r = await fetch('/api/reactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: deleting.code }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      await app.refresh();
      await load();
      app.toast('تم حذف الرياكشن من المكتبة');
      setDeleting(null);
    } catch (e) {
      app.toast(e instanceof Error ? e.message : 'تعذّر الحذف');
    } finally {
      setBusy(false);
    }
  }
  function exportReport() {
    if (!metrics) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            reactions: app.reactions,
            events: metrics.events,
            daily: metrics.daily,
            audit: metrics.audit,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'yemreact-report.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.toast('تقريرك جاهز، دون بيانات المستخدمين الشخصية.');
  }
  return (
    <section className="container admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-title">
          <Qusasa size={27} />
          الاستوديو<span className="tiny-tag">BETA</span>
        </div>
        <nav aria-label="أقسام لوحة الإدارة">
          {sections.map((s) => (
            <button
              key={s.id}
              className={tab === s.id ? 'active' : ''}
              aria-pressed={tab === s.id}
              onClick={() => setTab(s.id)}
            >
              <s.icon size={17} />
              {s.label}
            </button>
          ))}
        </nav>
        <p className="muted">
          SQLite · Local storage
          <br />
          المكتبة أداة استخدام،
          <br />
          وليست شبكة اجتماعية.
        </p>
      </aside>
      <div className="admin-main">
        <div className="admin-heading">
          <div>
            <span className="eyebrow">خلّ المكتبة في أحسن حال.</span>
            <h1>{sections.find((s) => s.id === tab)?.label}</h1>
            <p>
              {admin
                ? `أهلًا ${app.user?.name}، هذا مكان إدارة قصاصاتك.`
                : 'شاهد مساحة العمل. التعديل متاح للمالك فقط.'}
            </p>
          </div>
          {admin ? (
            <button className="btn btn-dark btn-small" onClick={() => setEditor('new')}>
              <Plus size={16} />
              رياكشن جديد
            </button>
          ) : (
            <Link className="btn btn-dark btn-small" href="/login">
              <LockKeyhole size={15} />
              دخول المالك
            </Link>
          )}
        </div>
        {!admin && (
          <div className="admin-banner">
            <ShieldCheck size={22} />
            <p>
              وضع الاطّلاع. الإضافة والحذف والبيانات الخاصة محمية بصلاحيات الخادم، وليست مخفية من
              الواجهة فقط.
            </p>
            <Link href="/login">تسجيل الدخول ↗</Link>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}{' '}
            <button className="text-button" onClick={load}>
              إعادة المحاولة
            </button>
          </p>
        )}
        {tab === 'overview' && (
          <>
            <div className="stats-grid">
              {[
                { label: 'الرياكشنات', value: app.reactions.length, note: 'في مكتبتك الآن' },
                { label: 'الفئات', value: CATEGORIES.length, note: 'لكل موقف، لون' },
                {
                  label: 'مرات التشغيل',
                  value: count('play'),
                  note: admin ? 'أحداث تشغيل فعلية' : 'متاحة للمالك فقط',
                },
                {
                  label: 'مرات التنزيل',
                  value: count('download'),
                  note: admin ? 'طلبات تنزيل ناجحة' : 'متاحة للمالك فقط',
                },
              ].map((s) => (
                <div className="stat-card" key={s.label}>
                  <span>{s.label}</span>
                  <b>{s.value}</b>
                  <small>{s.note}</small>
                </div>
              ))}
            </div>
            <div className="dashboard-grid">
              <div className="dashboard-panel">
                <h2>توزيع المواقف</h2>
                {CATEGORIES.map((c) => {
                  const n = app.reactions.filter((r) => r.category === c.id).length;
                  return (
                    <div className="category-bar" key={c.id}>
                      <span>{c.name}</span>
                      <div>
                        <i
                          style={{
                            background: c.color,
                            width: `${(n / Math.max(app.reactions.length, 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <b>{n}</b>
                    </div>
                  );
                })}
              </div>
              <div className="dashboard-panel">
                <h2>نشاط آخر 7 أيام</h2>
                {admin && metrics ? (
                  <>
                    {metrics.daily.length ? (
                      <div
                        className="chart"
                        role="img"
                        aria-label={metrics.daily.map((d) => `${d.day}: ${d.count} حدث`).join('، ')}
                      >
                        {metrics.daily.map((d) => (
                          <div
                            key={d.day}
                            style={{
                              height: `${Math.max(3, (d.count / Math.max(...metrics.daily.map((x) => x.count), 1)) * 100)}%`,
                            }}
                          >
                            <b>{d.count}</b>
                            <span>{d.day.slice(5)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-small">
                        <Film size={28} />
                        <p className="text-small">لا أحداث مسجلة بعد.</p>
                      </div>
                    )}
                    <p className="muted text-small">
                      تشغيل، تنزيل ومشاركة فقط. لا تتبع خارجي ولا هويات زوار.
                    </p>
                    <button className="text-button" onClick={exportReport}>
                      <Download size={15} />
                      تصدير التقرير
                    </button>
                  </>
                ) : (
                  <div className="empty-small">
                    <LockKeyhole size={28} />
                    <p className="text-small">
                      الأرقام الخاصة لا تظهر إلا للمالك. لا توجد إحصاءات وهمية.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="notice-box">
              <b>عن محتوى النسخة التجريبية</b>
              <p>
                {app.reactions.filter((r) => r.isDemo).length} نموذج متحرك من صور مولّدة. استبدلها
                بلقطات تملك حقوقها باستخدام «رياكشن جديد». لا تزل وسم النموذج من الوسائط التجريبية.
              </p>
            </div>
          </>
        )}
        {tab === 'content' && (
          <>
            <div className="admin-subtoolbar">
              <label className="sr-only" htmlFor="admin-search">
                بحث في الرياكشنات
              </label>
              <input
                id="admin-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث بالاقتباس أو الكود..."
              />
              <span className="muted text-small">{filtered.length} نتيجة</span>
            </div>
            <div
              className="admin-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="جدول الرياكشنات قابل للتمرير"
            >
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>الرياكشن</th>
                    <th>الفئة</th>
                    <th>المدة</th>
                    <th>المحتوى</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.code}>
                      <td>
                        <div className="table-reaction">
                          <Image src={r.poster} alt="" width={36} height={42} />
                          <div>
                            <b>{r.caption}</b>
                            <small className="mono">{r.code}</small>
                          </div>
                        </div>
                      </td>
                      <td>{CAT_BY_ID[r.category].name}</td>
                      <td>{r.duration}s</td>
                      <td>
                        <span className="status-pill">{r.isDemo ? 'نموذج' : 'مقطع مرفوع'}</span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="icon-btn"
                            aria-label={`معاينة ${r.caption}`}
                            onClick={() => app.setPreview(r.code)}
                          >
                            <Play size={15} />
                          </button>
                          {admin && (
                            <>
                              <button
                                className="icon-btn"
                                aria-label={`تعديل ${r.caption}`}
                                onClick={() => setEditor(r)}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                className="icon-btn danger-btn"
                                aria-label={`حذف ${r.caption}`}
                                onClick={() => setDeleting(r)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filtered.length && <div className="empty-small">مافي نتائج لهذا البحث.</div>}
            </div>
          </>
        )}
        {tab === 'media' && (
          <>
            <div className="admin-subtoolbar">
              <p className="muted text-small">
                ملفات مرتبطة بلقطات المكتبة. رفع ملفات جديدة من محرر الرياكشن.
              </p>
            </div>
            <div className="media-grid">
              {Array.from(new Map(app.reactions.map((r) => [r.media, r])).values()).map((r) => (
                <article className="media-tile" key={r.media}>
                  <Image src={r.poster} alt={r.caption} width={300} height={240} />
                  <div>
                    <b>{r.caption}</b>
                    <p className="muted">
                      {r.isDemo ? 'نموذج مولّد' : 'وسائط مرفوعة'} · {r.duration}s
                    </p>
                    <button className="text-button" onClick={() => app.setPreview(r.code)}>
                      <Play size={14} />
                      معاينة
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {tab === 'users' &&
          (admin && metrics ? (
            <div
              className="admin-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="قائمة المستخدمين"
            >
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>البريد</th>
                    <th>الصلاحية</th>
                    <th>تاريخ الإنشاء</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td dir="ltr">{u.email}</td>
                      <td>
                        <span className="status-pill">{u.role === 'admin' ? 'مدير' : 'عضو'}</span>
                      </td>
                      <td>{u.created_at.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="notice-box">
                عرض آخر 100 حساب. ترقية المديرين عبر أداة الخادم فقط؛ لا يمكن تعديل الصلاحيات من
                المتصفح.
              </p>
            </div>
          ) : (
            <PrivatePanel />
          ))}
        {tab === 'audit' &&
          (admin && metrics ? (
            <div className="dashboard-panel">
              <h2>آخر 40 عملية إدارية</h2>
              <ul className="audit-list">
                {metrics.audit.map((a, i) => (
                  <li key={`${a.created_at}-${i}`}>
                    <span>
                      <b>
                        {(
                          {
                            upsert: 'إضافة / تعديل',
                            delete: 'حذف',
                            register: 'حساب جديد',
                          } as Record<string, string>
                        )[a.action] || a.action}
                      </b>{' '}
                      — {a.detail}
                    </span>
                    <time>{new Date(a.created_at).toLocaleString('ar-YE')}</time>
                  </li>
                ))}
              </ul>
              {!metrics.audit.length && <p className="muted">لا توجد عمليات بعد.</p>}
            </div>
          ) : (
            <PrivatePanel />
          ))}
      </div>
      <Modal open={!!deleting} onClose={() => !busy && setDeleting(null)} title="نحذف القصاصة؟">
        <p>
          سيُحذف «{deleting?.caption}» من المكتبة ومحفوظات الحسابات. لا يمكن التراجع عن هذه العملية.
          الملف المرفوع يبقى على القرص حتى تنظفه يدويًا.
        </p>
        <div className="reaction-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-dark" disabled={busy} onClick={remove}>
            {busy ? 'جارٍ الحذف...' : 'نعم، احذفها'}
          </button>
          <button className="btn btn-outline" disabled={busy} onClick={() => setDeleting(null)}>
            لا، خلّها
          </button>
        </div>
      </Modal>
      {editor && (
        <Editor
          value={editor}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            await app.refresh();
            await load();
            setEditor(null);
          }}
        />
      )}
    </section>
  );
}
function PrivatePanel() {
  return (
    <div className="empty-state">
      <LockKeyhole size={40} />
      <h2>هنا خصوصية المكتبة.</h2>
      <p>سجّل الدخول بحساب المالك لعرض هذه البيانات.</p>
      <Link href="/login" className="btn btn-dark">
        دخول المالك
      </Link>
    </div>
  );
}
function Editor({
  value,
  onClose,
  onSaved,
}: {
  value: Reaction | 'new';
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const app = useApp();
  const fresh = value === 'new';
  const [r, setR] = useState<Reaction>(
    fresh
      ? {
          code: `YR-${Date.now().toString(36).toUpperCase()}`,
          caption: '',
          situation: '',
          category: 'laugh',
          duration: 2,
          keywords: [],
          publishedAt: new Date().toISOString().slice(0, 10),
          poster: '/media/portrait-1.webp',
          media: '/media/demo-1.mp4',
          isDemo: true,
          corner: 'tr',
          gradient: 'linear-gradient(155deg,#392b24,#171211)',
        }
      : value,
  );
  const [step, setStep] = useState(1),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [rights, setRights] = useState(false),
    [keywordText, setKeywordText] = useState(r.keywords.join('، '));
  function patch<K extends keyof Reaction>(key: K, v: Reaction[K]) {
    setR((old) => ({ ...old, [key]: v }));
  }
  async function upload(file: File | undefined, kind: 'image' | 'video') {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError('حجم الملف يتجاوز 15MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let duration = r.duration;
      if (kind === 'video') {
        const url = URL.createObjectURL(file);
        try {
          duration = await new Promise<number>((resolve, reject) => {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.onloadedmetadata = () => resolve(v.duration);
            v.onerror = () => reject(Error('تعذّرت قراءة الفيديو'));
            v.src = url;
          });
        } finally {
          URL.revokeObjectURL(url);
        }
        if (!Number.isFinite(duration) || duration < 2 || duration > 8.1)
          throw Error('اختر فيديو بين ثانيتين و8 ثوانٍ.');
      }
      const data = new FormData();
      data.set('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: data });
      const body = await res.json();
      if (!res.ok) throw Error(body.error);
      if (body.type !== kind) throw Error('نوع الملف لا يطابق الحقل.');
      if (kind === 'video')
        setR((old) => ({
          ...old,
          media: body.url,
          duration: Math.min(8, Math.round(duration * 10) / 10),
          isDemo: false,
        }));
      else patch('poster', body.url);
      app.toast('تم رفع الملف بنجاح');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر الرفع');
    } finally {
      setBusy(false);
    }
  }
  async function next(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    if (!r.isDemo && !rights) {
      setError('أكد امتلاكك حق مشاركة الملف أولًا.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...r,
          keywords: keywordText
            .split(/[,،]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 12),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw Error(body.error);
      await onSaved();
      app.toast(fresh ? 'قصاصة جديدة في المكتبة!' : 'حفظنا التعديلات');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={() => !busy && onClose()} title={fresh ? 'قصاصة جديدة' : 'تعديل القصاصة'}>
      <div className="segmented" aria-label="خطوات الإضافة">
        {['الموقف', 'الوسائط', 'المراجعة'].map((s, i) => (
          <span
            key={s}
            className="editor-step"
            style={{
              color: step === i + 1 ? 'var(--ink)' : 'var(--muted)',
              flex: 1,
              fontSize: 10,
              textAlign: 'center',
              padding: 8,
            }}
          >
            {i + 1}. {s}
          </span>
        ))}
      </div>
      <form className="stack-form" onSubmit={next}>
        {step === 1 && (
          <>
            <label>
              الاقتباس
              <input
                value={r.caption}
                onChange={(e) => patch('caption', e.target.value)}
                minLength={1}
                maxLength={100}
                required
                placeholder="مثلاً: يا ساتر!"
              />
            </label>
            <label>
              متى نستخدمه؟
              <textarea
                value={r.situation}
                onChange={(e) => patch('situation', e.target.value)}
                minLength={3}
                maxLength={250}
                required
                placeholder="لما تسمع خبر صادم..."
              />
            </label>
            <label>
              الفئة
              <select
                value={r.category}
                onChange={(e) => patch('category', e.target.value as Reaction['category'])}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              كلمات البحث
              <input
                value={keywordText}
                onChange={(e) => setKeywordText(e.target.value)}
                maxLength={400}
                placeholder="خبر، صدمة، مفاجأة"
              />
              <small>افصل الكلمات بفاصلة. حتى 12 كلمة، 40 حرفًا لكل كلمة.</small>
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <div className="upload-field">
              <label className="form-label">
                <Upload size={19} />
                فيديو الرياكشن
                <input
                  type="file"
                  accept="video/mp4,video/webm"
                  disabled={busy}
                  onChange={(e) => upload(e.target.files?.[0], 'video')}
                />
              </label>
              <p>MP4 أو WebM · 2–8 ثوانٍ · حتى 15MB</p>
              <p>{r.media}</p>
            </div>
            <div className="upload-field">
              <label className="form-label">
                <ImageIcon size={19} />
                صورة الغلاف
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  onChange={(e) => upload(e.target.files?.[0], 'image')}
                />
              </label>
              <p>JPG، PNG أو WebP</p>
            </div>
            <p className="muted text-small">أو اختر نموذجًا تجريبيًا. سيبقى موسومًا بأنه مولّد.</p>
            <div className="swatches" style={{ flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 6].map((n, i) => (
                <button
                  type="button"
                  key={n}
                  aria-label={`اختيار النموذج ${n}`}
                  aria-pressed={r.media === `/media/demo-${n}.mp4`}
                  style={{ borderRadius: 6, overflow: 'hidden', width: 48, height: 48, padding: 0 }}
                  onClick={() =>
                    setR((old) => ({
                      ...old,
                      media: `/media/demo-${n}.mp4`,
                      poster: `/media/portrait-${n}.webp`,
                      duration: [2, 3, 4, 3, 5, 2][i],
                      isDemo: true,
                    }))
                  }
                >
                  <Image alt="" src={`/media/portrait-${n}.webp`} width={48} height={48} />
                </button>
              ))}
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <div className="table-reaction">
              <Image src={r.poster} alt={r.caption} width={68} height={85} />
              <div>
                <h3>{r.caption}</h3>
                <p className="muted text-small">{r.situation}</p>
                <span className="status-pill">
                  {CAT_BY_ID[r.category].name} · {r.duration}s ·{' '}
                  {r.isDemo ? 'نموذج مولّد' : 'ملف مرفوع'}
                </span>
              </div>
            </div>
            <p className="muted text-small">
              ستظهر هذه القصاصة مباشرة في المكتبة العامة بعد النشر.
            </p>
            {!r.isDemo && (
              <label className="form-checkbox">
                <input
                  type="checkbox"
                  required
                  checked={rights}
                  onChange={(e) => setRights(e.target.checked)}
                />
                أملك حق استخدام ومشاركة هذا المحتوى.
              </label>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="reaction-actions">
          {step > 1 && (
            <button
              className="btn btn-outline"
              type="button"
              disabled={busy}
              onClick={() => setStep(step - 1)}
            >
              <ArrowRight size={15} />
              السابق
            </button>
          )}
          <button type="submit" className="btn btn-dark" disabled={busy}>
            {busy ? 'نجهّز القصاصة...' : step === 3 ? 'نشر القصاصة' : 'التالي'}
            {step === 3 ? <Check size={16} /> : <ArrowLeft size={16} />}
          </button>
        </div>
      </form>
    </Modal>
  );
}
