'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleX,
  Clock3,
  FileImage,
  FileVideo2,
  Send,
  UploadCloud,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { useContribution } from '@/components/ContributionProvider';
import { Modal } from '@/components/ui/Modal';
import type { MockSubmission } from '@/lib/contributions';
import { fileSizeLabel } from '@/lib/contributions';

const states = {
  pending: { text: 'قيد المراجعة', Icon: Clock3 },
  approved: { text: 'مقبولة', Icon: CheckCircle2 },
  rejected: { text: 'مرفوضة', Icon: CircleX },
};

export default function SubmissionsPage() {
  const app = useApp();
  const contribution = useContribution();
  const [selected, setSelected] = useState<MockSubmission | null>(null);
  const [previewEmpty, setPreviewEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const authorized = !!app.user || contribution.mockSignedIn;
  useEffect(() => {
    if (!contribution.ready || !app.authReady) return;
    const timer = setTimeout(() => setLoading(false), 260);
    return () => clearTimeout(timer);
  }, [contribution.ready, app.authReady]);
  useEffect(() => setPreviewEmpty(false), [contribution.records.length]);
  const items = previewEmpty ? [] : contribution.records;
  return (
    <section className="container submissions-page" aria-labelledby="submissions-title">
      <Link className="collection-back" href="/contribute">
        <ArrowRight size={17} aria-hidden="true" /> رجوع إلى المساهمة
      </Link>
      <div className="submissions-heading">
        <div>
          <span className="eyebrow">مساحة المساهمة</span>
          <h1 id="submissions-title">إرسالاتي</h1>
          <p>تجربة محاكاة محلية؛ هذه السجلات ليست إرسالات أو قرارات مراجعة حقيقية.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={contribution.requestOpen}
          disabled={!contribution.ready || !app.authReady}
        >
          <Send size={16} aria-hidden="true" /> أرسل رياكشن
        </button>
      </div>
      {loading ? (
        <div className="submission-list" role="status" aria-label="جارٍ تحميل الإرسالات التجريبية">
          {[0, 1, 2].map((number) => (
            <div className="submission-skeleton" key={number} aria-hidden="true">
              <i />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : !authorized ? (
        <div className="submissions-empty">
          <UploadCloud size={33} aria-hidden="true" />
          <h2>شاهد إرسالاتك التجريبية</h2>
          <p>جرّب محاكاة تسجيل Google أولًا. لا ينشئ ذلك حسابًا حقيقيًا.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={contribution.requestSubmissions}
          >
            عرض الإرسالات التجريبية
          </button>
        </div>
      ) : contribution.loadError ? (
        <div className="submissions-empty" role="alert">
          <CircleX size={32} aria-hidden="true" />
          <h2>تعذّر تحميل بيانات التجربة</h2>
          <p>{contribution.loadError}</p>
          <button type="button" className="btn btn-outline" onClick={contribution.reload}>
            حاول مرة ثانية
          </button>
        </div>
      ) : (
        <>
          <div className="submissions-demo-toolbar">
            <span>بيانات وهمية · لا مراجعة ولا نشر فعلي</span>
            <button
              type="button"
              className="text-button"
              onClick={() => setPreviewEmpty((value) => !value)}
            >
              {previewEmpty ? 'عرض إرسالات التجربة' : 'معاينة الحالة الفارغة'}
            </button>
          </div>
          {items.length ? (
            <div className="submission-list">
              {items.map((item) => {
                const { text, Icon } = states[item.status];
                return (
                  <button
                    type="button"
                    key={item.id}
                    className="submission-card"
                    onClick={() => setSelected(item)}
                    aria-label={`تفاصيل ${item.title}، ${text}`}
                  >
                    <div
                      className={`submission-thumbnail submission-thumbnail--${item.status}`}
                      aria-hidden="true"
                    >
                      {item.kind === 'video' ? <FileVideo2 size={26} /> : <FileImage size={26} />}
                    </div>
                    <span className="submission-card-copy">
                      <strong>{item.title}</strong>
                      <bdi className="mono" dir="ltr">
                        {item.id}
                      </bdi>
                      <span className={`submission-status submission-status--${item.status}`}>
                        <Icon size={14} aria-hidden="true" />
                        {text}
                      </span>
                      {item.status === 'rejected' && item.reason && (
                        <small>السبب: {item.reason}</small>
                      )}
                    </span>
                    <ArrowLeft className="submission-chevron" size={17} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="submissions-empty">
              <UploadCloud size={34} aria-hidden="true" />
              <h2>ما أرسلت شي بعد</h2>
              <p>شارك أول رياكشن!</p>
              <button type="button" className="btn btn-primary" onClick={contribution.requestOpen}>
                أرسل رياكشن
              </button>
            </div>
          )}
        </>
      )}
      {selected && (
        <Modal open title="تفاصيل الإرسال" onClose={() => setSelected(null)}>
          <div className="submission-detail">
            <div
              className={`submission-thumbnail submission-thumbnail--${selected.status}`}
              aria-hidden="true"
            >
              {selected.kind === 'video' ? <FileVideo2 size={35} /> : <FileImage size={35} />}
            </div>
            <h3>{selected.title}</h3>
            <bdi className="mono" dir="ltr">
              {selected.id}
            </bdi>
            <span className={`submission-status submission-status--${selected.status}`}>
              {(() => {
                const Icon = states[selected.status].Icon;
                return <Icon size={15} aria-hidden="true" />;
              })()}
              {states[selected.status].text}
            </span>
            {selected.character && (
              <p className="submission-detail-character">
                <span className="character-chip">{selected.character}</span>
              </p>
            )}
            {selected.secondary && (
              <details className="detail-secondary">
                <summary>الوصف الثنائي</summary>
                <p>{selected.secondary}</p>
              </details>
            )}
            {selected.fileName && (
              <p>
                الملف: {selected.fileName}{' '}
                {selected.fileSize ? `· ${fileSizeLabel(selected.fileSize)}` : ''}
              </p>
            )}
            <time dateTime={selected.createdAt}>
              تاريخ المثال:{' '}
              <bdi className="mono" dir="ltr">
                {selected.createdAt}
              </bdi>
            </time>
            {selected.status === 'rejected' && selected.reason && (
              <p className="submission-reason" role="status">
                سبب الرفض: {selected.reason}
              </p>
            )}
            {selected.status === 'approved' && selected.reactionUrl && (
              <Link
                href={selected.reactionUrl}
                className="btn btn-outline"
                onClick={() => setSelected(null)}
              >
                زيارة صفحة رياكشن منشور (مثال توضيحي) <ArrowLeft size={16} aria-hidden="true" />
              </Link>
            )}
            <p className="contribution-disclaimer">
              السجلات المعروضة محاكاة فقط؛ لا صلة بينها وبين حسابك أو الرياكشن الحقيقي في رابط
              المثال.
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}
