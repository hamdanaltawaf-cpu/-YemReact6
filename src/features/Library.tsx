'use client';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  X,
  SlidersHorizontal,
  ArrowLeft,
  Bookmark,
  Download,
  FolderHeart,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { ReactionCard } from '@/components/ReactionCard';
import { CATEGORIES } from '@/lib/categories';
import { filterReactions } from '@/lib/reactions';
export default function Library({ savedOnly = false }: { savedOnly?: boolean }) {
  const app = useApp(),
    params = useSearchParams(),
    router = useRouter();
  const [q, setQ] = useState(params.get('q') || ''),
    [cat, setCat] = useState(params.get('cat') || ''),
    [sort, setSort] = useState('newest'),
    [duration, setDuration] = useState(8),
    [limit, setLimit] = useState(8);
  useEffect(() => {
    setQ(params.get('q') || '');
    setCat(params.get('cat') || '');
  }, [params]);
  useEffect(() => {
    setLimit(8);
  }, [q, cat, sort, duration]);
  function update(query: string, category: string) {
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (category) p.set('cat', category);
    router.replace(`${savedOnly ? '/saved' : '/library'}${p.size ? '?' + p : ''}`, {
      scroll: false,
    });
  }
  const source = app.reactions.filter((r) => !savedOnly || app.saved.includes(r.code));
  const items = useMemo(
    () => filterReactions(source, q, cat, sort, duration),
    [source, q, cat, sort, duration],
  );
  const reset = () => {
    setQ('');
    setCat('');
    setSort('newest');
    setDuration(8);
    update('', '');
  };
  function exportCollection() {
    const blob = new Blob([JSON.stringify(source, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'yemreact-collection.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.toast('تم تصدير قائمة مجموعتك، دون ملفات الفيديو.');
  }
  return (
    <section className="container page-section">
      <div className="page-breadcrumb">
        <Link href="/">الرئيسية</Link>
        <span>/</span>
        <span>{savedOnly ? 'مجموعتك' : 'المكتبة'}</span>
      </div>
      <div className="section-heading page-heading">
        <div>
          <span className="eyebrow">
            {savedOnly ? 'اختياراتك، لوقتها المناسب.' : 'كل المواقف تبدأ من هنا.'}
          </span>
          <h1>{savedOnly ? 'ردودك، محفوظة.' : 'دوّر على موقفك.'}</h1>
          <p>
            {savedOnly
              ? app.user
                ? 'محفوظاتك مرتبطة بحسابك.'
                : 'محفوظة في هذا المتصفح. سجّل الدخول لحفظ اختياراتك عبر الأجهزة.'
              : 'اكتب اللي حاصل، خلّ الباقي علينا.'}
          </p>
        </div>
        <div className="page-heading-side">
          {savedOnly ? (
            <>
              <Bookmark size={27} />
              <span className="mono">{source.length} SAVED</span>
              {source.length > 0 && (
                <button className="text-button" onClick={exportCollection}>
                  <Download size={15} />
                  تصدير القائمة
                </button>
              )}
            </>
          ) : (
            <>
              <QusasaDecor />
              <span className="mono">{app.reactions.length} CLIPS / 09 MOODS</span>
            </>
          )}
        </div>
      </div>
      <div className="library-toolbar">
        <form
          role="search"
          className="search-field"
          onSubmit={(e) => {
            e.preventDefault();
            update(q, cat);
          }}
        >
          <Search size={21} />
          <label htmlFor="library-q" className="sr-only">
            ابحث عن موقف
          </label>
          <input
            id="library-q"
            data-search
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="موقف، كلمة، أو حتى كود الرياكشن..."
            maxLength={100}
          />
          {q && (
            <button
              type="button"
              aria-label="مسح البحث"
              className="icon-btn"
              onClick={() => {
                setQ('');
                update('', cat);
              }}
            >
              <X size={17} />
            </button>
          )}
          <button className="btn btn-dark btn-small" type="submit">
            ابحث
          </button>
        </form>
        <div className="filter-select">
          <SlidersHorizontal size={17} />
          <label htmlFor="sort" className="sr-only">
            ترتيب الرياكشنات
          </label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">الأحدث أولًا</option>
            <option value="oldest">الأقدم أولًا</option>
            <option value="shortest">الأقصر أولًا</option>
          </select>
        </div>
      </div>
      <div className="category-tabs">
        <button
          className={!cat ? 'active' : ''}
          aria-pressed={!cat}
          onClick={() => {
            setCat('');
            update(q, '');
          }}
        >
          ✳ الكل
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            aria-pressed={cat === c.id}
            className={cat === c.id ? 'active' : ''}
            onClick={() => {
              setCat(c.id);
              update(q, c.id);
            }}
          >
            <i style={{ background: c.color }} />
            {c.name}
          </button>
        ))}
      </div>
      <div className="results-row">
        <p role="status" aria-live="polite">
          <b>{items.length}</b> {savedOnly ? 'رياكشن في مجموعتك' : 'رياكشن في انتظارك'}
          {q && <> عن «{q}»</>}
        </p>
        <label className="duration-filter">
          المدة{' '}
          <select
            aria-label="أقصى مدة"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value={8}>كل المدد</option>
            <option value={3}>حتى 3 ثوانٍ</option>
            <option value={5}>حتى 5 ثوانٍ</option>
          </select>
        </label>
      </div>
      {items.length ? (
        <>
          <div className="reaction-grid">
            {items.slice(0, limit).map((r, i) => (
              <ReactionCard key={r.code} reaction={r} index={i} />
            ))}
          </div>
          <div className="center-action">
            <p className="muted text-small">
              عرض {Math.min(limit, items.length)} من {items.length}
            </p>
            {limit < items.length && (
              <button className="btn btn-outline" onClick={() => setLimit(limit + 8)}>
                أظهر المزيد <ArrowLeft size={17} />
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          {savedOnly && !source.length ? (
            <FolderHeart size={52} strokeWidth={1} />
          ) : (
            <Search size={52} strokeWidth={1} />
          )}
          <h2>
            {savedOnly && !source.length ? 'لسّه ما اخترت ردودك؟' : 'الموقف هذا... ما لقيناه بعد.'}
          </h2>
          <p>
            {savedOnly && !source.length
              ? 'اضغط علامة الحفظ على أي لقطة، وبتلاقيها هنا.'
              : 'جرّب كلمة أقصر، أو اختَر فئة ثانية.'}
          </p>
          {savedOnly && !source.length ? (
            <Link className="btn btn-dark" href="/library">
              خذ لفة في المكتبة <ArrowLeft size={17} />
            </Link>
          ) : (
            <button className="btn btn-dark" onClick={reset}>
              مسح الفلاتر
            </button>
          )}
        </div>
      )}
      <div className="library-note">
        <span>✳</span>
        <p>
          اللقطات المعلّمة «نموذج» معاينات متحركة من صور مولّدة، وليست مقاطع أصلية. بإمكان المالك
          رفع لقطاته المرخّصة من الاستوديو.
        </p>
      </div>
    </section>
  );
}
function QusasaDecor() {
  return <span className="little-star large">✳</span>;
}
