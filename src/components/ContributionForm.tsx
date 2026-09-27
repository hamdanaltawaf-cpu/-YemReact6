'use client';
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  Check,
  FileImage,
  FileVideo2,
  LoaderCircle,
  UploadCloud,
  X,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import {
  fileKind,
  fileSizeLabel,
  validateContributionFile,
  validateContributionText,
  type ContributionError,
} from '@/lib/contributions';
import { inspectContributionMedia } from '@/lib/contribution-media';

export type ContributionDraft = {
  file: File;
  kind: 'image' | 'video';
  title: string;
  character: string;
  secondary: string;
};

type FileState = 'empty' | 'checking' | 'ready' | 'error';
export function ContributionForm({ onSubmit }: { onSubmit: (draft: ContributionDraft) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [fileState, setFileState] = useState<FileState>('empty');
  const [checkingKind, setCheckingKind] = useState<'image' | 'video'>('image');
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [character, setCharacter] = useState('');
  const [secondary, setSecondary] = useState('');
  const [problem, setProblem] = useState<ContributionError | null>(null);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrl = useRef('');
  const task = useRef(0);
  const submitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      task.current++;
      if (submitTimer.current) clearTimeout(submitTimer.current);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  function clearFile() {
    task.current++;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = '';
    setUrl('');
    setFile(null);
    setFileState('empty');
    if (fileInput.current) fileInput.current.value = '';
  }
  async function choose(selected: File | undefined) {
    if (!selected) return;
    clearFile();
    const failure = validateContributionFile(selected);
    if (failure) {
      setFileState('error');
      setProblem(failure);
      return;
    }
    const kind = fileKind(selected)!;
    const current = task.current;
    const object = URL.createObjectURL(selected);
    objectUrl.current = object;
    setCheckingKind(kind);
    setFileState('checking');
    const [mediaError] = await Promise.all([
      inspectContributionMedia(object, kind).catch(() => ({
        title: 'تعذّر تجهيز الملف',
        message: 'حدثت مشكلة أثناء فحص الملف في هذا المتصفح. جرّب ملفًا آخر.',
      })),
      new Promise((resolve) => setTimeout(resolve, 200)),
    ]);
    if (task.current !== current) return;
    if (mediaError) {
      URL.revokeObjectURL(object);
      objectUrl.current = '';
      setFileState('error');
      setProblem(mediaError);
      return;
    }
    setFile(selected);
    setUrl(object);
    setFileState('ready');
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void choose(event.dataTransfer.files[0]);
  }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || fileState !== 'ready' || sending) return;
    const textError = validateContributionText(title, character, secondary);
    if (textError) {
      setProblem(textError);
      return;
    }
    setSending(true);
    submitTimer.current = setTimeout(() => {
      onSubmit({ file, kind: fileKind(file)!, title, character, secondary });
      setSending(false);
    }, 650);
  }
  return (
    <>
      <form className="contribution-form" onSubmit={send}>
        <p className="contribution-disclaimer">
          تجربة محلية فقط: يتحقق المتصفح من الملف دون رفعه إلى الخادم أو إضافته إلى المكتبة.
        </p>
        <div className="contribution-field">
          <span className="contribution-label">
            ملف الرياكشن <span aria-hidden="true">*</span>
          </span>
          <input
            ref={fileInput}
            className="contribution-file-input"
            type="file"
            tabIndex={-1}
            accept=".mp4,.mov,.webm,.jpg,.jpeg,.png,.webp,video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
            aria-label="اختيار ملف الرياكشن"
            onChange={(event) => void choose(event.target.files?.[0])}
          />
          {fileState === 'ready' && file && url ? (
            <div className="contribution-uploaded" aria-label="تم اختيار الملف">
              <div className="contribution-preview">
                {fileKind(file) === 'image' ? (
                  // A local blob URL cannot go through next/image; object-fit prevents letterboxing.
                  <img src={url} alt={`معاينة الملف ${file.name}`} />
                ) : (
                  <video
                    src={url}
                    aria-label={`معاينة الملف ${file.name}`}
                    controls
                    playsInline
                    preload="metadata"
                  />
                )}
              </div>
              <div className="contribution-file-info">
                {fileKind(file) === 'image' ? <FileImage size={17} /> : <FileVideo2 size={17} />}
                <span title={file.name}>{file.name}</span>
                <bdi className="mono" dir="ltr">
                  {fileSizeLabel(file.size)}
                </bdi>
              </div>
              <button
                type="button"
                className="contribution-remove"
                aria-label="إزالة الملف"
                onClick={clearFile}
              >
                <X size={17} />
              </button>
            </div>
          ) : fileState === 'checking' ? (
            <div className="contribution-checking" role="status" aria-live="polite">
              <LoaderCircle size={20} className="contribution-spinner" aria-hidden="true" />
              <strong>
                {checkingKind === 'video'
                  ? 'جارٍ فحص المدة وحواف الفيديو...'
                  : 'جارٍ التحقق من الصورة...'}
              </strong>
              <small>الفحص داخل المتصفح فقط؛ لا يبدأ أي رفع.</small>
            </div>
          ) : (
            <div
              className={`contribution-drop-area${dragging ? ' is-dragging' : ''}${fileState === 'error' ? ' has-error' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
              }}
              onDrop={onDrop}
            >
              {fileState === 'error' ? (
                <AlertCircle size={27} aria-hidden="true" />
              ) : (
                <UploadCloud size={27} aria-hidden="true" />
              )}
              <strong>{fileState === 'error' ? 'اختر ملفًا آخر' : 'اختر فيديو أو صورة'}</strong>
              <span>اسحب الملف هنا أو اضغط للاختيار</span>
              <button
                type="button"
                className="btn btn-outline contribution-pick"
                onClick={() => fileInput.current?.click()}
              >
                {fileState === 'error' ? 'جرب ملفًا آخر' : 'اختيار ملف'}
              </button>
              <small>JPG / PNG / WebP · MP4 / MOV / WebM · حتى 80MB · فيديو 2–60s</small>
            </div>
          )}
        </div>
        <label className="contribution-field" htmlFor="contribution-title">
          <span className="contribution-label">
            العنوان / الوصف الأساسي <span aria-hidden="true">*</span>
          </span>
          <input
            id="contribution-title"
            value={title}
            maxLength={100}
            required
            placeholder="اكتب وصفًا قصيرًا..."
            onChange={(event) => setTitle(event.target.value)}
            aria-describedby="contribution-title-counter"
          />
          <small className="contribution-counter mono" id="contribution-title-counter" dir="ltr">
            {title.length}/100
          </small>
        </label>
        <label className="contribution-field" htmlFor="contribution-character">
          <span className="contribution-label">اسم الشخصية (اختياري)</span>
          <input
            id="contribution-character"
            value={character}
            maxLength={50}
            placeholder="مثال: مصطفى المومري"
            onChange={(event) => setCharacter(event.target.value)}
          />
        </label>
        <label className="contribution-field" htmlFor="contribution-secondary">
          <span className="contribution-label">الوصف الثنائي (اختياري)</span>
          <textarea
            id="contribution-secondary"
            value={secondary}
            maxLength={300}
            rows={3}
            placeholder="كلام مضمن أو نص مستخرج..."
            onChange={(event) => setSecondary(event.target.value)}
          />
        </label>
        <button
          className="btn btn-primary contribution-submit"
          type="submit"
          disabled={fileState !== 'ready' || !file || !title.trim() || sending}
        >
          {sending ? (
            <>
              <LoaderCircle size={16} className="contribution-spinner" aria-hidden="true" /> جارٍ
              الإرسال التجريبي...
            </>
          ) : (
            <>
              <Check size={17} aria-hidden="true" /> أرسل رياكشن
            </>
          )}
        </button>
      </form>
      {problem && (
        <Modal open title={problem.title} onClose={() => setProblem(null)}>
          <div className="contribution-error-dialog" role="alert">
            <AlertCircle size={30} aria-hidden="true" />
            <p>{problem.message}</p>
            <button type="button" className="btn btn-dark" onClick={() => setProblem(null)}>
              جرب ملفًا آخر
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
