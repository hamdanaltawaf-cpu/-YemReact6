/** Contribution demo data. This module never publishes to the reaction library. */
export const MAX_CONTRIBUTION_BYTES = 80 * 1024 * 1024;
export const MIN_CONTRIBUTION_SECONDS = 2;
export const MAX_CONTRIBUTION_SECONDS = 60;
export const CONTRIBUTION_STORAGE_KEY = 'yr:contribution-demo-v1';
export const MOCK_GOOGLE_SESSION_KEY = 'yr:contribution-demo-google-v1';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type MockSubmission = {
  id: string;
  title: string;
  character: string;
  secondary: string;
  status: SubmissionStatus;
  createdAt: string;
  kind: 'image' | 'video';
  fileName?: string;
  fileSize?: number;
  reason?: string;
  reactionUrl?: string;
};
export type ContributionError = { title: string; message: string };
export type FileDescription = Pick<File, 'name' | 'size' | 'type'>;

const imageTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const videoTypes: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};
export function fileKind(file: FileDescription): 'image' | 'video' | null {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (imageTypes[ext] && (!file.type || file.type === imageTypes[ext])) return 'image';
  if (videoTypes[ext] && (!file.type || file.type === videoTypes[ext])) return 'video';
  return null;
}
export function validateContributionFile(file: FileDescription): ContributionError | null {
  if (!fileKind(file))
    return {
      title: 'نوع الملف غير مدعوم',
      message:
        'اختر صورة JPG أو PNG أو WebP، أو فيديو MP4 أو MOV أو WebM. يجب أن يطابق الامتداد نوع الملف.',
    };
  if (!file.size)
    return { title: 'الملف فارغ', message: 'الملف الذي اخترته بلا محتوى. اختر ملفًا آخر.' };
  if (file.size > MAX_CONTRIBUTION_BYTES)
    return { title: 'الملف كبير جدًا', message: 'الحد الأقصى 80MB. اختر ملفًا أصغر.' };
  return null;
}
export function validateContributionDuration(duration: number): ContributionError | null {
  if (!Number.isFinite(duration) || duration <= 0)
    return {
      title: 'تعذّر قراءة مدة الفيديو',
      message: 'لا يستطيع المتصفح قراءة مدة هذا المقطع. جرّب MP4 أو WebM صالحًا في متصفحك.',
    };
  if (duration < MIN_CONTRIBUTION_SECONDS)
    return {
      title: 'المقطع قصير جدًا (الحد الأدنى 2s)',
      message: 'اختر مقطعًا مدته ثانيتان على الأقل.',
    };
  if (duration > MAX_CONTRIBUTION_SECONDS)
    return {
      title: 'المقطع طويل جدًا (الحد الأقصى 60s)',
      message: 'اختر مقطعًا مدته 60 ثانية أو أقل.',
    };
  return null;
}
export function validateContributionText(title: string, character: string, secondary: string) {
  if (!title.trim())
    return { title: 'العنوان مطلوب', message: 'اكتب العنوان / الوصف الأساسي قبل الإرسال.' };
  if (title.trim().length > 100)
    return { title: 'العنوان طويل جدًا', message: 'الحد الأقصى 100 حرف للعنوان / الوصف الأساسي.' };
  if (character.trim().length > 50)
    return { title: 'اسم الشخصية طويل جدًا', message: 'الحد الأقصى 50 حرف لاسم الشخصية.' };
  if (secondary.trim().length > 300)
    return { title: 'الوصف الثنائي طويل جدًا', message: 'الحد الأقصى 300 حرف للوصف الثنائي.' };
  return null;
}
export function fileSizeLabel(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The supplied fixture's YR-0042 is not in the 12-item demo catalog. Link to a real demo route instead. */
export const mockSubmissions: MockSubmission[] = [
  {
    id: 'SUB-2026-0001',
    title: 'لما صاحبك يقول بكرة',
    character: 'مصطفى المومري',
    secondary: '',
    status: 'pending',
    createdAt: '2026-09-25',
    kind: 'video',
  },
  {
    id: 'SUB-2026-0002',
    title: 'اقرب اقرب لو انت رجال',
    character: 'هديل مانع',
    secondary: '',
    status: 'approved',
    createdAt: '2026-09-23',
    kind: 'video',
    reactionUrl: '/r/YR-0001',
  },
  {
    id: 'SUB-2026-0003',
    title: 'رياكشن بدون سياق',
    character: '',
    secondary: '',
    status: 'rejected',
    reason: 'المدة تتجاوز 60s',
    createdAt: '2026-09-20',
    kind: 'video',
  },
];

export function nextSubmissionId(items: Pick<MockSubmission, 'id'>[], year = 2026) {
  const prefix = `SUB-${year}-`;
  const serial = Math.max(
    0,
    ...items
      .filter((item) => item.id.startsWith(prefix))
      .map((item) => Number(item.id.slice(prefix.length)) || 0),
  );
  return `${prefix}${String(serial + 1).padStart(4, '0')}`;
}

/** Read metadata only. Never persist file bytes, object URLs, cookies or a real auth identity. */
export function readDemoSubmissions(storage: Pick<Storage, 'getItem'>): MockSubmission[] {
  const raw = storage.getItem(CONTRIBUTION_STORAGE_KEY);
  if (!raw) return mockSubmissions;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw Error('تعذّر قراءة إرسالات التجربة المحلية.');
  const added: MockSubmission[] = parsed.slice(0, 50).map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw Error('تعذّر قراءة إرسالات التجربة المحلية.');
    const item = entry as Partial<MockSubmission>;
    if (!/^SUB-\d{4}-\d{4}$/.test(String(item.id)) || typeof item.title !== 'string')
      throw Error('تعذّر قراءة إرسالات التجربة المحلية.');
    return {
      id: item.id as string,
      title: item.title.slice(0, 100),
      character: typeof item.character === 'string' ? item.character.slice(0, 50) : '',
      secondary: typeof item.secondary === 'string' ? item.secondary.slice(0, 300) : '',
      status: 'pending',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt.slice(0, 10) : '',
      kind: item.kind === 'video' ? 'video' : 'image',
      fileName: typeof item.fileName === 'string' ? item.fileName.slice(0, 150) : undefined,
      fileSize: typeof item.fileSize === 'number' ? item.fileSize : undefined,
    };
  });
  return [...added, ...mockSubmissions];
}
