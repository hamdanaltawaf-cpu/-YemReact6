'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';

type Report = { id: number; code: string; reason: string; detail: string; created_at: string };
export default function ReportsStudio() {
  const { reactions } = useApp();
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/reports')
      .then(async (response) => {
        if (!response.ok) throw Error('تعذّر تحميل البلاغات.');
        setReports((await response.json()).reports);
      })
      .catch((failure) => setError(failure.message));
  }, []);
  return (
    <div className="reports-studio">
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {reports.length > 0 && (
        <ul className="audit-list">
          {reports.map((report) => (
            <li key={report.id}>
              <div>
                <strong>{report.reason}</strong>
                {' — '}
                {reactions.some((reaction) => reaction.code === report.code) ? (
                  <Link href={`/r/${report.code}`}>
                    {reactions.find((reaction) => reaction.code === report.code)?.caption}
                  </Link>
                ) : (
                  <span className="mono">{report.code}</span>
                )}
                {report.detail && <p>{report.detail}</p>}
              </div>
              <time dateTime={report.created_at}>
                {new Date(report.created_at).toLocaleDateString('ar-YE-u-nu-latn')}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
