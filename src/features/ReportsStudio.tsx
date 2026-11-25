'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { Modal } from '@/components/ui/Modal';

type Report = {
  id: number;
  code: string;
  reason: string;
  detail: string;
  created_at: string;
  status: 'open' | 'reviewing' | 'resolved';
  resolution: string;
  review_note: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  hidden: boolean;
  caption: string | null;
};
type Action = 'review' | 'keep' | 'hide' | 'restore' | 'delete';
const statusLabels = { open: 'جديد', reviewing: 'قيد المراجعة', resolved: 'مُعالج' };
const resolutionLabels: Record<string, string> = {
  keep: 'أُبقي في المكتبة',
  hide: 'مخفي من المكتبة',
  restore: 'أُعيد إلى المكتبة',
  delete: 'حُذف من المكتبة',
};

export default function ReportsStudio() {
  const app = useApp();
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState<'all' | Report['status']>('all');
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reports?status=${status}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'تعذّر تحميل البلاغات.');
      setReports(body.reports);
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'تعذّر تحميل البلاغات.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function mutate(report: Report, action: Action) {
    setBusy(report.id);
    try {
      const response = await fetch('/api/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, action, note: notes[report.id] || '' }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'تعذّر تحديث البلاغ.');
      await app.refresh();
      await load();
      setNotes((current) => {
        const updated = { ...current };
        delete updated[report.id];
        return updated;
      });
      setDeleteTarget(null);
      app.toast(
        action === 'hide'
          ? 'تم إخفاء الرياكشن من الواجهات العامة.'
          : action === 'restore'
            ? 'أُعيد الرياكشن إلى المكتبة العامة.'
            : action === 'delete'
              ? 'تم حذف الرياكشن من المكتبة.'
              : 'تم تحديث حالة البلاغ.',
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'تعذّر تحديث البلاغ.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="reports-studio">
      <div className="report-toolbar">
        <label htmlFor="report-status">عرض البلاغات</label>
        <select
          id="report-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="all">كل الحالات</option>
          <option value="open">جديدة</option>
          <option value="reviewing">قيد المراجعة</option>
          <option value="resolved">مُعالجة</option>
        </select>
        <button type="button" className="text-button" onClick={load} disabled={loading}>
          تحديث القائمة
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loading && (
        <p className="muted" role="status">
          جارٍ تحميل البلاغات…
        </p>
      )}
      {!loading && reports.length > 0 && (
        <ul className="audit-list report-list">
          {reports.map((report) => (
            <li key={report.id} className="report-card">
              <div className="report-card-main">
                <div className="report-heading-row">
                  <strong>{report.reason}</strong>
                  <span className="status-pill" data-status={report.status}>
                    {statusLabels[report.status]}
                  </span>
                </div>
                <div>
                  {report.caption && !report.hidden ? (
                    <Link href={`/r/${report.code}`}>{report.caption}</Link>
                  ) : (
                    <span>{report.caption || report.code}</span>
                  )}{' '}
                  {report.hidden && <span className="status-pill">مخفي حاليًا</span>}
                </div>
                {report.detail && (
                  <p>
                    <b>تفاصيل البلاغ:</b> {report.detail}
                  </p>
                )}
                {report.resolution && (
                  <p>
                    <b>القرار:</b> {resolutionLabels[report.resolution] || report.resolution}
                  </p>
                )}
                {report.reviewed_at && (
                  <p>
                    <b>المراجع:</b> {report.reviewed_by_name || report.reviewed_by || '—'}
                    {' · '}
                    <time dateTime={report.reviewed_at}>
                      {new Date(report.reviewed_at).toLocaleDateString('ar-YE-u-nu-latn')}
                    </time>
                  </p>
                )}
                {report.review_note && (
                  <p>
                    <b>ملاحظة المراجعة:</b> {report.review_note}
                  </p>
                )}
                <label className="report-note-label" htmlFor={`report-note-${report.id}`}>
                  ملاحظة المراجع (اختيارية، حتى 500 حرف)
                </label>
                <textarea
                  id={`report-note-${report.id}`}
                  maxLength={500}
                  rows={2}
                  value={notes[report.id] ?? report.review_note}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [report.id]: event.target.value }))
                  }
                  disabled={busy === report.id}
                />
                <div className="report-actions" aria-label={`إجراءات البلاغ ${report.id}`}>
                  {report.status !== 'reviewing' && (
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      onClick={() => mutate(report, 'review')}
                      disabled={busy === report.id}
                    >
                      {report.status === 'resolved' ? 'إعادة فتح للمراجعة' : 'بدء المراجعة'}
                    </button>
                  )}
                  {report.status !== 'resolved' && (
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      onClick={() => mutate(report, 'keep')}
                      disabled={busy === report.id}
                    >
                      إغلاق وإبقاء المحتوى
                    </button>
                  )}
                  {report.hidden ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      onClick={() => mutate(report, 'restore')}
                      disabled={busy === report.id}
                    >
                      استعادة إلى المكتبة
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline btn-small"
                      onClick={() => mutate(report, 'hide')}
                      disabled={busy === report.id || !report.caption}
                    >
                      إخفاء من المكتبة
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-small danger-btn"
                    onClick={() => setDeleteTarget(report)}
                    disabled={busy === report.id || !report.caption}
                  >
                    حذف نهائي
                  </button>
                </div>
              </div>
              <time dateTime={report.created_at}>
                {new Date(report.created_at).toLocaleDateString('ar-YE-u-nu-latn')}
              </time>
            </li>
          ))}
        </ul>
      )}
      {!loading && reports.length === 0 && (
        <div className="empty-small">لا توجد بلاغات ضمن هذه الحالة.</div>
      )}
      <Modal
        open={!!deleteTarget}
        onClose={() => busy === null && setDeleteTarget(null)}
        title="حذف الرياكشن نهائيًا؟"
      >
        <p>
          سيُحذف «{deleteTarget?.caption}» من المكتبة، وتُحذف ارتباطاته بالمحفوظات وعناصر المجموعات.
          لا يمكن التراجع عن الحذف. يبقى ملف الوسائط على التخزين حتى تنظيفه يدويًا.
        </p>
        <div className="reaction-actions" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="btn btn-dark"
            disabled={busy !== null || !deleteTarget}
            onClick={() => deleteTarget && mutate(deleteTarget, 'delete')}
          >
            {busy !== null ? 'جارٍ الحذف…' : 'تأكيد الحذف'}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy !== null}
            onClick={() => setDeleteTarget(null)}
          >
            إلغاء
          </button>
        </div>
      </Modal>
    </div>
  );
}
