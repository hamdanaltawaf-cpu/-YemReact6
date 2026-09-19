'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpLeft,
  Search,
  Play,
  Bookmark,
  Download,
  Sparkles,
  Plus,
  Check,
  MousePointer2,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { ReactionCard } from '@/components/ReactionCard';
import { Qusasa } from '@/components/Qusasa';
import { CATEGORIES } from '@/lib/categories';
export default function Home() {
  const app = useApp(),
    [cat, setCat] = useState('');
  const items = app.reactions.filter((r) => !cat || r.category === cat).slice(0, 8);
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow">
            <span className="live-dot" /> من الموقف... إلى الردّ المناسب{' '}
            <span className="mono">V.04</span>
          </div>
          <h1 className="hero-title">
            الموقف يمني.
            <br />
            <span>والردّ جاهز.</span>
            <svg className="headline-scribble" viewBox="0 0 310 19" aria-hidden="true">
              <path
                d="M5 12 Q140 -3 302 9 M32 17 Q175 6 275 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </h1>
          <p className="hero-description">
            ضحكة، صدمة، أو «عاد شي عقل؟»
            <br />
            رياكشنات تتكلّم بلسانك، لكل موقف ما لقيت له كلام.
          </p>
          <form action="/library" className="hero-search" role="search">
            <Search size={21} />
            <label htmlFor="hero-q" className="sr-only">
              ابحث عن موقف
            </label>
            <input
              id="hero-q"
              name="q"
              data-search
              placeholder="إيش الموقف اللي أنت فيه؟"
              autoComplete="off"
              maxLength={100}
            />
            <kbd>/</kbd>
            <button type="submit" aria-label="ابحث في المكتبة">
              <ArrowLeft size={21} />
            </button>
          </form>
          <div className="quick-search">
            <span>جرّب:</span>
            {['خبر صادم', 'بكرة أسددلك', 'هدف'].map((q) => (
              <Link key={q} href={`/library?q=${encodeURIComponent(q)}`}>
                {q}
                <ArrowUpLeft size={12} />
              </Link>
            ))}
          </div>
          <div className="hero-meta">
            <span>
              <i className="little-star">✳</i> خذها. حطها. يمنية.
            </span>
            <a href="#how-it-works">
              كيف تشتغل؟ <ArrowDownLeft size={17} />
            </a>
          </div>
        </div>
        <div className="hero-art" aria-label="نماذج بصرية من المكتبة">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="art-cross cross-one">+</span>
          <span className="art-cross cross-two">+</span>
          <div className="art-stamp">
            <Sparkles size={14} /> من عندنا، ولنا.
          </div>
          <button
            className="hero-polaroid polaroid-back"
            onClick={() => app.setPreview('YR-0002')}
            aria-label="لما الكلام ما يدخل العقل عاد شي عقل؟ — معاينة"
          >
            <Image
              src="/media/portrait-3.webp"
              alt="شخصية مولّدة بتعبير ساخر"
              fill
              loading="eager"
              sizes="240px"
            />
            <div>
              <span>لما الكلام ما يدخل العقل</span>
              <b>عاد شي عقل؟</b>
            </div>
          </button>
          <button
            className="hero-polaroid polaroid-front"
            onClick={() => app.setPreview('YR-0006')}
            aria-label="YR—0006 03s ضحك من القلب ياخي وربي! — معاينة"
          >
            <Image
              src="/media/portrait-2.webp"
              alt="شخصية مولّدة تضحك"
              fill
              priority
              fetchPriority="high"
              sizes="320px"
            />
            <span className="polaroid-code mono">
              YR—0006 <i /> 03s
            </span>
            <span className="polaroid-play">
              <Play size={27} fill="currentColor" />
            </span>
            <div className="polaroid-caption">
              <span>
                <i /> ضحك من القلب
              </span>
              <b>ياخي وربي!</b>
            </div>
            <span className="polaroid-corner">
              <Qusasa size={17} tone="ink" />
            </span>
          </button>
          <div className="floating-note">
            <span className="note-icon">
              <Check size={20} />
            </span>
            <span>
              <b>هذا هو الرد!</b>
              <small>لقطة قصيرة. معنى كبير.</small>
            </span>
          </div>
          <div className="art-bottom">
            <svg width="62" height="44" viewBox="0 0 62 44" aria-hidden="true">
              <path
                d="M2 3Q8 50 54 20M42 18L57 18L53 34"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
            <span>
              المثل الشعبي...
              <br />
              بس بنسخة رقمية.
            </span>
          </div>
          <small className="art-disclaimer">صور مولّدة • نماذج للمعاينة</small>
        </div>
      </section>
      <div className="word-ribbon" aria-hidden="true">
        <div>
          {[...Array(2)].map((_, i) => (
            <span key={i}>
              يا ساتر! <i>✳</i> عاد شي عقل؟ <i>✳</i> قوية جدًا <i>✳</i> صلّي على النبي <i>✳</i> معك
              حق <i>✳</i> ياخي وربي <i>✳</i> يووه! <i>✳</i>
            </span>
          ))}
        </div>
      </div>
      <section className="container section library-section" id="discover">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              <span className="small-line" /> المكتبة، على مزاجك
            </span>
            <h2>
              لكل موقف، <em>رياكشن.</em>
            </h2>
            <p>لقطات صغيرة. تقول كل شيء.</p>
          </div>
          <Link className="text-button" href="/library">
            كل المكتبة <span className="count-badge">{app.reactions.length}</span>
            <ArrowLeft size={18} />
          </Link>
        </div>
        <div className="category-tabs" aria-label="تصفية المكتبة">
          <button aria-pressed={!cat} className={!cat ? 'active' : ''} onClick={() => setCat('')}>
            <span>✳</span>كل المواقف
          </button>
          {CATEGORIES.map((c) => (
            <button
              aria-pressed={cat === c.id}
              className={cat === c.id ? 'active' : ''}
              onClick={() => setCat(c.id)}
              key={c.id}
            >
              <i style={{ background: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
        <div className="gallery-caption">
          <span>
            <span className="live-dot" /> مختارة لك
          </span>
          <span>نماذج تجريبية متحركة • {items.length} لقطات</span>
        </div>
        <div className="reaction-grid">
          {items.map((r, i) => (
            <ReactionCard reaction={r} index={i} key={r.code} />
          ))}
        </div>
        {!items.length && <p className="empty-small">ما عندنا لقطات في هذه الفئة بعد.</p>}
        <div className="center-action">
          <Link href="/library" className="btn btn-outline">
            لسّه في ردود كثيرة <ArrowLeft size={17} />
          </Link>
        </div>
      </section>
      <section className="container section how-section" id="how-it-works">
        <div className="section-heading">
          <div>
            <span className="eyebrow">بلا تعقيد. بلا كلام كثير.</span>
            <h2>
              من هنا... <em>إلى محادثتك.</em>
            </h2>
          </div>
          <span className="hand-note">ثلاث خطوات، وخلاص ↙</span>
        </div>
        <div className="steps-grid">
          {[
            {
              n: '01',
              title: 'لقِ الموقف',
              desc: 'اكتب اللي حاصل، أو دوّر بالفئة. الرد المناسب أقرب مما تتوقع.',
              icon: Search,
            },
            {
              n: '02',
              title: 'خُذ اللقطة',
              desc: 'عاينها، نزّلها، أو احفظها لوقتها. المقاطع قصيرة وجاهزة.',
              icon: Download,
            },
            {
              n: '03',
              title: 'حُطّها في محلّها',
              desc: 'في القروب، في الرد، في اللحظة الصح. وخلي الرياكشن يتكلم.',
              icon: MousePointer2,
            },
          ].map((s) => (
            <div className="step-card" key={s.n}>
              <div>
                <s.icon size={25} />
                <span className="mono">{s.n}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="container story-section">
        <div className="story-copy">
          <span className="eyebrow">مش صفحة ميمز. مكتبة تستخدمها.</span>
          <h2>
            كان لكل موقف مَثَل.
            <br />
            واليوم، له <em>رياكشن.</em>
          </h2>
          <p>
            نفس الروح اليمنية، في قصاصة رقمية. لحظة من حكاية أطول، تصير كلمتك في اللحظة المناسبة.
          </p>
          <Link className="btn btn-paper" href="/about">
            هذه حكايتنا <ArrowUpLeft size={18} />
          </Link>
        </div>
        <div className="story-mark" aria-hidden="true">
          <div className="story-mark-ring" />
          <Qusasa size={150} tone="gradient" />
          <span>القُصاصة</span>
          <small>SMALL CLIP. BIG FEELING.</small>
        </div>
      </section>
      <section className="container collection-callout">
        <div className="callout-icon">
          <Bookmark size={30} />
        </div>
        <div>
          <h3>ردودك المفضّلة، في مكان واحد.</h3>
          <p>احفظ اللقطة، وارجع لها لما يجي موقفها. حتى بدون حساب.</p>
        </div>
        <Link className="text-button" href="/saved">
          افتح مجموعتك <ArrowLeft size={18} />
        </Link>
      </section>
    </>
  );
}
