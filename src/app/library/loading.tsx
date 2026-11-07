import { StatePanel } from '@/components/ui/StatePanel';

export default function Loading() {
  return (
    <div className="container library-feed">
      <StatePanel kind="loading" title="جارٍ تحميل المكتبة" heading="h2">
        <div className="state-loading-grid" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i}>
              <i />
              <span />
            </div>
          ))}
        </div>
      </StatePanel>
    </div>
  );
}
