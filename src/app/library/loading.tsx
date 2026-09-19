export default function Loading() {
  return (
    <div className="container page-section skeleton" role="status" aria-label="تحميل المحتوى">
      <div className="loading-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} />
        ))}
      </div>
      <span className="sr-only">نجهّز ردودك...</span>
    </div>
  );
}
