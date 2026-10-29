/**
 * Decides whether a deployment under verification is the one we just shipped.
 *
 * Render reports RENDER_GIT_COMMIT for Git-connected deployments, so the commit
 * can be compared exactly (`expectRevision`). The generic `deployedAt` fallback
 * remains available to callers verifying a deployment without revision metadata.
 *
 * Kept separate from the verifier so the rule is unit-tested and cannot drift.
 *
 * @typedef {object} WaitInput
 * @property {number|null} status HTTP status of /api/health, null when unreachable.
 * @property {string} [revision] Revision reported by the deployment, if any.
 * @property {string} [startedAt] When the running container started, if reported.
 * @property {string} [expectRevision] Commit this run expects live ('' disables).
 * @property {string} [deployedAt] When the deploy step ran ('' disables).
 * @property {number} [slackMs] Allowance for build/start time before the step ended.
 */
export const FRESHNESS_SLACK_MS = 300_000;

/** @param {string|undefined} value */
function parseTime(value) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/**
 * @param {WaitInput} input
 * @returns {{ ready: boolean, note: string }}
 */
export function deploymentReady(input) {
  const { status, expectRevision = '', deployedAt = '' } = input;
  if (status === null)
    return { ready: false, note: 'تعذّر الوصول إلى الخدمة (لا استجابة من /api/health).' };
  if (status === 404)
    return {
      ready: false,
      note: 'النشرة الحالية لا تتضمن /api/health بعد (بناء أقدم من هذا التغيير).',
    };
  if (status !== 200) return { ready: false, note: `حالة /api/health: ${status}.` };

  const revision = (input.revision || '').trim();
  if (expectRevision) {
    if (revision) {
      const matches =
        revision.startsWith(expectRevision) ||
        expectRevision.startsWith(revision) ||
        revision === expectRevision;
      return matches
        ? { ready: true, note: `الإصدار المنشور يطابق الالتزام ${revision.slice(0, 7)}.` }
        : {
            ready: false,
            note: `الإصدار المنشور ${revision.slice(0, 7)} لم يصل إلى ${expectRevision.slice(0, 7)} بعد.`,
          };
    }
    // Uploaded deploys have no commit: fall back to "the container is newer than
    // the deploy step" so a fresh build still counts as verified.
    const deployed = parseTime(deployedAt);
    const started = parseTime(input.startedAt);
    if (deployed === null)
      return {
        ready: true,
        note: 'الخدمة لا تُبلّغ عن إصدار ولم تُمرَّر مرجعية زمنية؛ اعتُبرت الاستجابة 200 دليلًا على النشرة.',
      };
    if (started === null)
      return {
        ready: true,
        note: 'الخدمة لا تُبلّغ عن إصدار ولا عن زمن التشغيل؛ اعتُبرت الاستجابة 200 دليلًا على النشرة.',
      };
    const slack = input.slackMs ?? FRESHNESS_SLACK_MS;
    const ageMs = deployed - started;
    return ageMs <= slack
      ? {
          ready: true,
          note: `حاوية حديثة (بدأت قبل ${Math.round(ageMs / 1000)}ث من مرجعية النشر).`,
        }
      : {
          ready: false,
          note: `النسخة المنشورة أقدم من هذه النشرة بفارق ${Math.round(ageMs / 1000)}ث؛ لم يصل بناء جديد بعد.`,
        };
  }
  return { ready: true, note: 'استجابة صحية 200 (بلا شرط إصدار).' };
}
