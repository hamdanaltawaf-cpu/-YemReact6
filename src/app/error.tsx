'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="container page-section empty-state">
      <h1>حصلت لخبطة بسيطة.</h1>
      <p>تعذّر تحميل الصفحة. بياناتك المحفوظة لم تُحذف.</p>
      <button className="btn btn-dark" onClick={reset}>
        جرّب مرة ثانية
      </button>
    </section>
  );
}
