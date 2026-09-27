'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ArrowLeft, UploadCloud } from 'lucide-react';
import { useApp } from './AppProvider';
import { Modal } from './ui/Modal';
import { SocialIcon } from './SocialIcon';
import { ContributionForm, type ContributionDraft } from './ContributionForm';
import {
  CONTRIBUTION_STORAGE_KEY,
  MOCK_GOOGLE_SESSION_KEY,
  mockSubmissions,
  nextSubmissionId,
  readDemoSubmissions,
  type MockSubmission,
} from '@/lib/contributions';

type View = 'closed' | 'signin' | 'form' | 'success';
type ContributionContext = {
  mockSignedIn: boolean;
  ready: boolean;
  records: MockSubmission[];
  loadError: string;
  requestOpen: () => void;
  requestSubmissions: () => void;
  endMockSession: () => void;
  reload: () => void;
};
const Context = createContext<ContributionContext | null>(null);

export function ContributionProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [mockSignedIn, setMockSignedIn] = useState(false);
  const [records, setRecords] = useState<MockSubmission[]>(mockSubmissions);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<View>('closed');
  const [afterSignIn, setAfterSignIn] = useState<'form' | 'submissions'>('form');
  const [success, setSuccess] = useState<MockSubmission | null>(null);
  const [storageNote, setStorageNote] = useState('');
  function reload() {
    try {
      setRecords(readDemoSubmissions(localStorage));
      setLoadError('');
    } catch {
      setLoadError(
        'تعذّر قراءة إرسالات التجربة المحلية. تحقّق من تخزين المتصفح ثم حاول مرة ثانية.',
      );
    }
  }
  useEffect(() => {
    try {
      setMockSignedIn(sessionStorage.getItem(MOCK_GOOGLE_SESSION_KEY) === 'true');
    } catch {
      // Private browsing can disable session storage. Keep the in-memory mock usable.
    }
    reload();
    setReady(true);
  }, []);
  function requestOpen() {
    if (!ready || !app.authReady) return;
    setStorageNote('');
    setAfterSignIn('form');
    setView(app.user || mockSignedIn ? 'form' : 'signin');
  }
  function requestSubmissions() {
    if (!ready || !app.authReady) return;
    setStorageNote('');
    setAfterSignIn('submissions');
    if (app.user || mockSignedIn) router.push('/account/submissions');
    else setView('signin');
  }
  function signInMock() {
    try {
      sessionStorage.setItem(MOCK_GOOGLE_SESSION_KEY, 'true');
    } catch {
      setStorageNote('جلسة الدخول التجريبية مؤقتة؛ قد تنتهي عند إعادة تحميل الصفحة.');
    }
    setMockSignedIn(true);
    if (afterSignIn === 'submissions') {
      setView('closed');
      router.push('/account/submissions');
    } else setView('form');
  }
  function endMockSession() {
    try {
      sessionStorage.removeItem(MOCK_GOOGLE_SESSION_KEY);
    } catch {
      // The in-memory session can still be ended if storage is unavailable.
    }
    setMockSignedIn(false);
    setView('closed');
  }
  function submit(draft: ContributionDraft) {
    const created: MockSubmission = {
      id: nextSubmissionId(records),
      title: draft.title.trim(),
      character: draft.character.trim(),
      secondary: draft.secondary.trim(),
      status: 'pending',
      createdAt: new Date().toISOString().slice(0, 10),
      kind: draft.kind,
      fileName: draft.file.name,
      fileSize: draft.file.size,
    };
    const next = [created, ...records];
    setRecords(next);
    setSuccess(created);
    setView('success');
    try {
      // Store metadata only, never the binary file or a fake server session.
      localStorage.setItem(
        CONTRIBUTION_STORAGE_KEY,
        JSON.stringify(next.filter((item) => !mockSubmissions.some((seed) => seed.id === item.id))),
      );
      setStorageNote('');
    } catch {
      setStorageNote('لم يمكن حفظ بيانات التجربة في هذا المتصفح؛ ستختفي بعد إغلاق الجلسة.');
    }
  }
  function showSubmissions() {
    setView('closed');
    router.push('/account/submissions');
  }
  return (
    <Context.Provider
      value={{
        mockSignedIn,
        ready,
        records,
        loadError,
        requestOpen,
        requestSubmissions,
        endMockSession,
        reload,
      }}
    >
      {children}
      <Modal
        open={view !== 'closed'}
        onClose={() => setView('closed')}
        title={
          view === 'signin'
            ? afterSignIn === 'submissions'
              ? 'عرض إرسالاتي'
              : 'ساهم برياكشن'
            : view === 'success'
              ? 'تم استلام رياكشنك!'
              : 'أرسل رياكشن'
        }
      >
        {view === 'signin' && (
          <div className="contribution-signin">
            <div className="contribution-hero-icon" aria-hidden="true">
              <UploadCloud size={30} />
            </div>
            <h3>
              {afterSignIn === 'submissions'
                ? 'إرسالاتك التجريبية في مكان واحد'
                : 'شارك لقطة من عندك'}
            </h3>
            <p>
              {afterSignIn === 'submissions'
                ? 'جرّب جلسة Google الوهمية لعرض أمثلة حالات الإرسال في هذا المتصفح.'
                : 'للمتابعة في هذا النموذج، جرّب محاكاة الدخول باستخدام Google.'}
            </p>
            <button type="button" className="btn btn-dark mock-google-btn" onClick={signInMock}>
              <SocialIcon provider="google" /> متابعة باستخدام Google (محاكاة)
            </button>
            <p className="contribution-disclaimer">
              محاكاة واجهة فقط: لن نتصل بـ Google، ولن ننشئ حسابًا أو جلسة حقيقية.
            </p>
          </div>
        )}
        {view === 'form' && <ContributionForm onSubmit={submit} />}
        {view === 'success' && success && (
          <div className="contribution-success" role="status">
            <div className="contribution-success-icon" aria-hidden="true">
              <CheckCircle2 size={35} />
            </div>
            <h3>تم استلام رياكشنك!</h3>
            <p>
              رقم التتبع:{' '}
              <bdi className="mono" dir="ltr">
                {success.id}
              </bdi>
            </p>
            <p>
              الحالة: <strong>قيد المراجعة</strong>
            </p>
            <p>
              سيتم مراجعته خلال 24–48 ساعة <span className="muted">(مثال توضيحي).</span>
            </p>
            <div className="contribution-success-actions">
              <button type="button" className="btn btn-primary" onClick={showSubmissions}>
                عرض إرسالاتي <ArrowLeft size={16} aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setView('form')}>
                إرسال آخر
              </button>
            </div>
            <p className="contribution-disclaimer">
              بيانات وهمية محفوظة محليًا فقط؛ لم يُرفع الملف، ولا توجد مراجعة حقيقية.
            </p>
            {storageNote && (
              <p className="contribution-storage-note" role="alert">
                {storageNote}
              </p>
            )}
          </div>
        )}
      </Modal>
    </Context.Provider>
  );
}

export function useContribution() {
  const context = useContext(Context);
  if (!context) throw Error('ContributionProvider missing');
  return context;
}
