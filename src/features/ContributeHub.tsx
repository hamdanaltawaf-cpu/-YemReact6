'use client';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileVideo2,
  LockKeyhole,
  UploadCloud,
} from 'lucide-react';
import { useApp } from '@/components/AppProvider';
import { useContribution } from '@/components/ContributionProvider';

/** The hub is a product lane, not an upload endpoint. Every action stays in the mock provider. */
export default function ContributeHub() {
  const app = useApp();
  const demo = useContribution();
  const signedIn = !!app.user || demo.mockSignedIn;
  const ready = app.authReady && demo.ready;
  const pending = demo.records.filter((item) => item.status === 'pending').length;
  const approved = demo.records.filter((item) => item.status === 'approved').length;
  const rejected = demo.records.filter((item) => item.status === 'rejected').length;

  return (
    <div className="container contribute-hub">
      <header className="contribute-hub-heading">
        <div>
          <span className="eyebrow">
            <span className="live-dot" /> مساحة المشاركة
          </span>
          <h1>المساهمة</h1>
          <p>جهّز رياكشنًا، واطّلع على خطواته وحالاته من مكان واحد.</p>
        </div>
        <span className="contribute-demo-pill">
          <LockKeyhole size={14} aria-hidden="true" /> نموذج محلي فقط
        </span>
      </header>

      <div className="contribute-hub-grid">
        <section className="contribute-start" aria-labelledby="contribute-start-title">
          <span className="contribute-card-kicker">
            <UploadCloud size={17} aria-hidden="true" /> ابدأ من هنا
          </span>
          <h2 id="contribute-start-title">عندك لقطة تستاهل المشاركة؟</h2>
          <p>
            اختر صورة أو فيديو، واكتب له عنوانًا واضحًا. سنجهّز معاينة في متصفحك قبل الإرسال
            التجريبي.
          </p>
          <div className="contribute-specs" aria-label="شروط الملف">
            <span>صورة أو فيديو</span>
            <span>
              حتى <bdi dir="ltr">80MB</bdi>
            </span>
            <span>
              الفيديو <bdi dir="ltr">2–60s</bdi>
            </span>
          </div>
          <button
            type="button"
            className="btn btn-primary contribute-start-action"
            onClick={demo.requestOpen}
            disabled={!ready}
          >
            {ready ? 'ابدأ إرسال رياكشن' : 'يتم تجهيز التجربة...'}{' '}
            <ArrowLeft size={17} aria-hidden="true" />
          </button>
          <p className="contribute-card-note">
            {signedIn
              ? 'جاهز للتجربة. لن يُرفع الملف أو يظهر في المكتبة.'
              : 'قبل الإرسال، ستظهر محاكاة دخول Google؛ لا تنشئ حسابًا حقيقيًا.'}
          </p>
        </section>

        <section className="contribute-workspace" aria-labelledby="contribute-workspace-title">
          <div className="contribute-workspace-head">
            <span className="contribute-card-kicker">
              <Clock3 size={17} aria-hidden="true" /> مساحتك التجريبية
            </span>
            <h2 id="contribute-workspace-title">إرسالاتي</h2>
            <p>تابع ما جرّبته هنا، وشاهد أمثلة على حالات المراجعة. ليست قرارات نشر حقيقية.</p>
          </div>
          {ready && demo.loadError ? (
            <div className="contribute-workspace-error" role="alert">
              <AlertCircle size={19} aria-hidden="true" />
              <p>{demo.loadError}</p>
              <button type="button" className="text-button" onClick={demo.reload}>
                حاول مرة ثانية
              </button>
            </div>
          ) : ready && signedIn ? (
            <div className="contribute-status-overview" aria-label="ملخّص الإرسالات التجريبية">
              <div>
                <strong className="mono" dir="ltr">
                  {pending}
                </strong>
                <span>قيد المراجعة</span>
              </div>
              <div>
                <strong className="mono" dir="ltr">
                  {approved}
                </strong>
                <span>مقبولة</span>
              </div>
              <div>
                <strong className="mono" dir="ltr">
                  {rejected}
                </strong>
                <span>مرفوضة</span>
              </div>
            </div>
          ) : (
            <p className="contribute-workspace-guest">
              ابدأ جلسة المحاكاة لعرض الحالات الثلاث النموذجية وإرسالات هذا المتصفح.
            </p>
          )}
          <button
            type="button"
            className="btn btn-outline contribute-workspace-action"
            onClick={demo.requestSubmissions}
            disabled={!ready}
          >
            {signedIn ? 'عرض إرسالاتي' : 'استكشف إرسالات التجربة'}{' '}
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
        </section>
      </div>

      <section className="contribute-process" aria-labelledby="contribute-process-title">
        <div className="contribute-process-heading">
          <span className="eyebrow">خطوات واضحة</span>
          <h2 id="contribute-process-title">كيف تعمل التجربة؟</h2>
        </div>
        <ol>
          <li>
            <span className="contribute-step-icon" aria-hidden="true">
              <FileVideo2 size={21} />
            </span>
            <strong>جهّز الملف</strong>
            <p>صورة JPG أو PNG أو WebP، أو فيديو MP4 أو MOV أو WebM.</p>
          </li>
          <li>
            <span className="contribute-step-icon" aria-hidden="true">
              <UploadCloud size={21} />
            </span>
            <strong>صف اللقطة</strong>
            <p>عنوان واحد واضح، مع اسم شخصية ووصف إضافي إن احتجتهما.</p>
          </li>
          <li>
            <span className="contribute-step-icon" aria-hidden="true">
              <CheckCircle2 size={21} />
            </span>
            <strong>شاهد الحالة</strong>
            <p>احصل على رقم تتبّع تجريبي وتعرّف على أمثلة القبول والرفض.</p>
          </li>
        </ol>
      </section>
      <aside className="contribute-trust-note" aria-label="خصوصية النموذج">
        <LockKeyhole size={19} aria-hidden="true" />
        <p>
          ملفاتك لا تغادر الجهاز. تُحفظ بيانات الإرسال الوصفية في هذا المتصفح فقط، ولا يرتبط هذا
          النموذج بحسابك الحقيقي أو بالمكتبة المنشورة.
        </p>
        <Link href="/privacy">
          الخصوصية <ArrowLeft size={14} aria-hidden="true" />
        </Link>
      </aside>
    </div>
  );
}
