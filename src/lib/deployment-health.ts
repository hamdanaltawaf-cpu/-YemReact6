/**
 * Read-only deployment checks shared by the public `/api/health` endpoint and the
 * post-deploy verifier (`scripts/verify-deployment.mjs`, GitHub Actions).
 *
 * Everything here is pure: no database, filesystem or network access. The route
 * gathers facts and this module only decides what they mean, so the verifier and
 * the endpoint can never disagree about the contract.
 */
export const SITE_URL_VARIABLE = 'NEXT_PUBLIC_SITE_URL';
export const DATA_DIR_VARIABLE = 'DATA_DIR';
export const FFPROBE_VARIABLE = 'FFPROBE_PATH';
export const OWNERS_PROMOTION_HINT =
  "بعد أول دخول اجتماعي شغّل من طرفية الخدمة: ADMIN_USER_ID='<معرف الحساب>' pnpm admin:create";
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

export type DeployLevel = 'ok' | 'warn' | 'fail';
export type DeployCheck = { id: string; level: DeployLevel; detail: string };

export type DeploymentFacts = {
  nodeEnv: string;
  siteUrl?: string;
  dataDir?: string;
  ffprobePath?: string;
  /** Result of probing the configured ffprobe binary, when the caller checked it. */
  ffprobeAvailable?: boolean;
  oauthSiteUrl?: string;
  socialProviders: readonly string[];
  reactions?: number;
  owners?: number;
  uploadsWritable?: boolean;
};

function parseUrl(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
const isLocalHost = (hostname: string) => LOCAL_HOSTS.includes(hostname);

/** Metadata, sitemap and JSON-LD are baked from this value at build time. */
export function siteUrlCheck({ siteUrl, nodeEnv }: DeploymentFacts): DeployCheck {
  const url = parseUrl(siteUrl);
  if (!url)
    return {
      id: 'site-url',
      level: nodeEnv === 'production' ? 'fail' : 'warn',
      detail: `${SITE_URL_VARIABLE} غير مضبوط: ستبقى روابط metadata وOG وsitemap وJSON-LD على localhost:3000. اضبطه على النطاق العام ثم أعد البناء (القيمة تُدمج وقت البناء).`,
    };
  if (isLocalHost(url.hostname))
    return nodeEnv === 'production'
      ? {
          id: 'site-url',
          level: 'fail',
          detail: `${SITE_URL_VARIABLE} ما زال localhost في بيئة إنتاج. اضبطه على نطاق HTTPS العام وأعد البناء.`,
        }
      : { id: 'site-url', level: 'ok', detail: `بيئة تطوير محلية (${url.origin}).` };
  if (url.protocol !== 'https:')
    return {
      id: 'site-url',
      level: 'fail',
      detail: `العنوان العام يستخدم ${url.protocol} بدل https؛ روابط العودة في OAuth وسياسة الكوكي الآمن تتطلبان HTTPS.`,
    };
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
    return {
      id: 'site-url',
      level: 'warn',
      detail: `${SITE_URL_VARIABLE} يجب أن يكون أصل الموقع فقط دون مسار أو استعلام أو بيانات دخول؛ القيمة الحالية ${url.origin}${url.pathname}.`,
    };
  return { id: 'site-url', level: 'ok', detail: `النطاق العام: ${url.origin}` };
}

/** SQLite and uploads must live on a mounted persistent volume. */
export function dataDirCheck({ dataDir }: DeploymentFacts): DeployCheck {
  if (!dataDir)
    return {
      id: 'data-dir',
      level: 'warn',
      detail: `${DATA_DIR_VARIABLE} غير مضبوط: سيُستخدم ./data داخل مجلد العمل، وتُفقد قاعدة البيانات والملفات المرفوعة عند كل إعادة نشر. اربطه بقرص دائم مثل /app/data.`,
    };
  if (!dataDir.startsWith('/'))
    return {
      id: 'data-dir',
      level: 'warn',
      detail: `${DATA_DIR_VARIABLE} نسبي (${dataDir}). في الحاويات اربطه بمسار قرص دائم مطلق مثل /app/data.`,
    };
  return { id: 'data-dir', level: 'ok', detail: `مسار البيانات: ${dataDir}` };
}

/** Uploads verify durations, dimensions and posters through FFprobe/FFmpeg. */
export function ffprobeCheck({ ffprobePath, ffprobeAvailable }: DeploymentFacts): DeployCheck {
  if (!ffprobePath)
    return {
      id: 'ffprobe',
      level: 'warn',
      detail: `${FFPROBE_VARIABLE} غير مضبوط: سيُبحث عن ffprobe في PATH. بلا FFmpeg/FFprobe يفشل التحقق من الوسائط ورفع الفيديو.`,
    };
  if (ffprobeAvailable === false)
    return {
      id: 'ffprobe',
      level: 'fail',
      detail: `تعذّر تنفيذ ffprobe على المسار ${ffprobePath}: التحقق من الوسائط ورفع الفيديو سيفشل. صحّح ${FFPROBE_VARIABLE} أو ثبّت FFmpeg.`,
    };
  return { id: 'ffprobe', level: 'ok', detail: `ffprobe: ${ffprobePath}` };
}

/** Social-only authentication: no provider configured means no login at all. */
export function socialAuthCheck({ oauthSiteUrl, socialProviders }: DeploymentFacts): DeployCheck {
  if (oauthSiteUrl) {
    const url = parseUrl(oauthSiteUrl);
    if (!url?.protocol.startsWith('https'))
      return {
        id: 'social-auth',
        level: 'fail',
        detail:
          'OAUTH_SITE_URL يجب أن يكون عنوان HTTPS لبناء redirect_uri؛ غير ذلك يُرفض إعداد المزوّد بالكامل.',
      };
  }
  if (!socialProviders.length)
    return {
      id: 'social-auth',
      level: 'warn',
      detail:
        'الدخول الاجتماعي معطّل: لا يوجد مزوّد مهيّأ. اضبط OAUTH_SITE_URL وOAUTH_<PROVIDER>_CLIENT_ID/SECRET وسجّل روابط العودة على المزوّد. راجع docs/SOCIAL-AUTH.md',
    };
  return {
    id: 'social-auth',
    level: 'ok',
    detail: `مزوّدون مهيّأون: ${socialProviders.join(', ')}`,
  };
}

/** The first social account must be promoted before the studio is reachable. */
export function ownerCheck({ owners }: DeploymentFacts): DeployCheck {
  if (owners === undefined)
    return { id: 'owner', level: 'warn', detail: 'تعذّر قراءة عدد حسابات المالك.' };
  if (owners === 0)
    return {
      id: 'owner',
      level: 'warn',
      detail: `لا يوجد حساب مالك بعد؛ لوحة الإدارة ستبقى غير متاحة. ${OWNERS_PROMOTION_HINT}`,
    };
  return { id: 'owner', level: 'ok', detail: `حسابات المالك: ${owners}` };
}

/** A volume that is not writable silently breaks every studio upload. */
export function storageCheck({ uploadsWritable }: DeploymentFacts): DeployCheck {
  if (uploadsWritable === false)
    return {
      id: 'uploads',
      level: 'fail',
      detail:
        'مجلد الرفع غير قابل للكتابة: تأكد من تثبيت قرص دائم على مسار DATA_DIR وأن صلاحياته للمستخدم node.',
    };
  if (uploadsWritable === undefined)
    return {
      id: 'uploads',
      level: 'warn',
      detail: 'تعذّر التحقق من صلاحية الكتابة في مجلد الرفع.',
    };
  return { id: 'uploads', level: 'ok', detail: 'مجلد الرفع قابل للكتابة.' };
}

/** An empty catalog usually means a fresh volume, not a healthy deploy. */
export function contentCheck({ reactions }: DeploymentFacts): DeployCheck {
  if (reactions === undefined)
    return { id: 'content', level: 'warn', detail: 'تعذّر قراءة عدد الرياكشنات.' };
  if (reactions === 0)
    return {
      id: 'content',
      level: 'warn',
      detail: 'لا توجد رياكشنات منشورة في قاعدة البيانات؛ المكتبة ستبدو فارغة.',
    };
  return { id: 'content', level: 'ok', detail: `رياكشنات منشورة: ${reactions}` };
}

export function collectDeployChecks(facts: DeploymentFacts): DeployCheck[] {
  return [
    siteUrlCheck(facts),
    dataDirCheck(facts),
    ffprobeCheck(facts),
    socialAuthCheck(facts),
    storageCheck(facts),
    ownerCheck(facts),
    contentCheck(facts),
  ];
}

/** `fail` only when something is actively broken, so a deploy gate can trust it. */
export function deployLevel(checks: readonly DeployCheck[]): DeployLevel {
  if (checks.some((check) => check.level === 'fail')) return 'fail';
  if (checks.some((check) => check.level === 'warn')) return 'warn';
  return 'ok';
}
