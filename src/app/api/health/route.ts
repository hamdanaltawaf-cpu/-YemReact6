import { execFile } from 'node:child_process';
import { constants, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { db, listReactions } from '@/server/db';
import { oauthConfig } from '@/server/oauth-config';
import { SOCIAL_PROVIDERS } from '@/lib/social';
import { collectDeployChecks, deployLevel, type DeploymentFacts } from '@/lib/deployment-health';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const run = promisify(execFile);

/** Deployment commit, so the post-deploy verifier can wait for the new build to serve. */
function deployedRevision() {
  return (
    // ضرورة ثابتة لتوجيه فحوص CI إلى معاينة Render: الخدمة تُبلّغ التزامها عبر
    // RENDER_GIT_COMMIT وقت التشغيل (تزوّده منصة Render للخدمات المبنية من Git)،
    // فبدونه يفقد --expect-revision مقارنته الحرفية مع GITHUB_SHA. بلا أن يمس
    // ذلك أي بيانات أو سلوك مستخدم.
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_COMMIT_SHA ||
    process.env.SOURCE_VERSION ||
    ''
  );
}
const uploadsPath = () => path.resolve(process.env.DATA_DIR || 'data', 'uploads');

async function uploadsWritable(): Promise<boolean | undefined> {
  try {
    const dir = uploadsPath();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await access(dir, constants.W_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function ffprobeAvailable(): Promise<boolean | undefined> {
  const binary = process.env.FFPROBE_PATH || 'ffprobe';
  try {
    await run(binary, ['-version'], { timeout: 5000, maxBuffer: 64 * 1024, windowsHide: true });
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    // A non-zero exit from an existing binary still means it can be executed.
    return (e as { code?: string })?.code === undefined ? false : true;
  }
}

function ownerCount(): number | undefined {
  try {
    const row = db.prepare("SELECT COUNT(*) AS total FROM users WHERE role='owner'").get() as
      { total: number } | undefined;
    return row?.total ?? 0;
  } catch {
    return undefined;
  }
}

/**
 * Public, read-only deployment health. Exposes counts and configuration shape only:
 * never environment values that are secrets, accounts or uploaded file names.
 */
export async function GET() {
  const providers = SOCIAL_PROVIDERS.filter((provider) => oauthConfig(provider) !== null);
  let reactions: number | undefined;
  try {
    reactions = listReactions().length;
  } catch {
    reactions = undefined;
  }
  const facts: DeploymentFacts = {
    nodeEnv: process.env.NODE_ENV || 'development',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    dataDir: process.env.DATA_DIR,
    ffprobePath: process.env.FFPROBE_PATH,
    ffprobeAvailable: await ffprobeAvailable(),
    oauthSiteUrl: process.env.OAUTH_SITE_URL,
    socialProviders: providers,
    reactions,
    owners: ownerCount(),
    uploadsWritable: await uploadsWritable(),
  };
  const checks = collectDeployChecks(facts);
  const level = deployLevel(checks);
  return Response.json(
    {
      ok: level !== 'fail',
      level,
      revision: deployedRevision(),
      // CLI uploads carry no commit; the process start time proves freshness instead.
      startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      nodeEnv: facts.nodeEnv,
      node: process.version,
      siteUrl: facts.siteUrl || null,
      dataDir: facts.dataDir || null,
      socialProviders: providers,
      counts: { reactions: reactions ?? null, owners: facts.owners ?? null },
      checks,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
