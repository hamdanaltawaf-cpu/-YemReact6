'use client';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { Reaction } from '@/lib/reactions';
import { useApp } from '@/components/AppProvider';
import { ClipPlayer, ReactionActions } from '@/components/Clip';
import { ReactionCard } from '@/components/ReactionCard';
export default function Detail({ reaction }: { reaction: Reaction }) {
  const app = useApp();
  const related = app.reactions
    .filter((r) => r.code !== reaction.code)
    .sort(
      (a, b) => Number(b.category === reaction.category) - Number(a.category === reaction.category),
    )
    .slice(0, 4);
  return (
    <section className="container page-section">
      <nav className="page-breadcrumb" aria-label="مسار الصفحة">
        <Link href="/">الرئيسية</Link>
        <span>/</span>
        <Link href="/library">المكتبة</Link>
        <span>/</span>
        <span>{reaction.caption}</span>
      </nav>
      <div className="detail-grid">
        <div className="detail-media">
          <div className="ambient-glow" />
          <ClipPlayer reaction={reaction} />
        </div>
        <div className="detail-copy">
          <h1>{reaction.caption}</h1>
          <p className="detail-situation">{reaction.situation}</p>
          <div className="detail-facts">
            <span>
              <CheckCircle2 size={16} />
              {reaction.isDemo ? 'نموذج تجريبي' : 'مضاف للمكتبة'}
            </span>
            <span>MP4 / WebM</span>
          </div>
          <ReactionActions reaction={reaction} />
          {reaction.isDemo && (
            <div className="notice-box">
              <b>عن هذا النموذج</b>
              <p>
                معاينة متحركة بلا صوت، مصنوعة من صورة مولّدة بالذكاء الاصطناعي. ليست لقطة أصلية أو
                أداءً لشخص حقيقي. التنزيل يعمل للملف التجريبي نفسه.
              </p>
            </div>
          )}
          <Link href="/library" className="text-button">
            <ArrowRight size={16} />
            العودة للمكتبة
          </Link>
        </div>
      </div>
      <div className="section-heading related-heading">
        <div>
          <span className="eyebrow">يمكن هذا كمان يقول اللي في بالك</span>
          <h2>ردود قريبة.</h2>
        </div>
        <Link href="/library" className="text-button">
          شوف الكل <ArrowRight size={16} />
        </Link>
      </div>
      <div className="reaction-grid">
        {related.map((r) => (
          <ReactionCard reaction={r} key={r.code} />
        ))}
      </div>
    </section>
  );
}
