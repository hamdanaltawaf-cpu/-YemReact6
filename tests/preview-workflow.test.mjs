import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
const quality = workflow.split('  quality:\n')[1].split('  verify:\n')[0];
const verify = workflow.split('  verify:\n')[1];
function evaluate(expression, context) {
  assert.ok(expression);
  return vm.runInNewContext(expression.replace(/^\$\{\{\s*|\s*\}\}$/g, ''), context);
}
const condition = (job) => job.match(/^    if: (.+)$/m)?.[1];

test('Preview workflow evaluates its actual conditions across the event/result matrix', () => {
  for (const event of ['push', 'pull_request', 'workflow_dispatch']) {
    for (const verifyOnly of [false, true]) {
      const context = {
        github: { event_name: event },
        inputs: { verify_only: verifyOnly },
        always: () => true,
      };
      assert.equal(
        evaluate(condition(quality), context),
        event !== 'workflow_dispatch' || !verifyOnly,
      );
      for (const result of ['success', 'skipped', 'failure', 'cancelled']) {
        for (const cancelled of [false, true]) {
          assert.equal(
            evaluate(condition(verify), {
              ...context,
              needs: { quality: { result } },
              cancelled: () => cancelled,
            }),
            !cancelled && event !== 'pull_request' && ['success', 'skipped'].includes(result),
            `${event}, verify_only=${verifyOnly}, quality=${result}, cancelled=${cancelled}`,
          );
        }
      }
    }
  }
});

test('Preview workflow retains health, revision and bounded warmup without a legacy deploy path', () => {
  assert.match(verify, /needs: \[quality\]/);
  assert.doesNotMatch(workflow, /railway|deploy_only|needs\.deploy|--deployed-at/i);
  assert.equal(existsSync('railway.json'), false);
  assert.match(workflow, /PREVIEW_BASE_URL:.*vars\.PREVIEW_BASE_URL/);
  assert.match(verify, /--warm 180/);
  assert.match(verify, /--expect-revision "\$GITHUB_SHA"/);
  assert.match(verify, /WAIT_SECONDS: \$\{\{ vars\.VERIFY_WAIT_SECONDS \|\| '900' \}\}/);
  const revisionCondition = verify.match(/WAIT_FOR_REVISION: (.+)/)[1];
  for (const event of ['push', 'workflow_dispatch']) {
    for (const verifyOnly of [false, true]) {
      assert.equal(
        evaluate(revisionCondition, {
          github: { event_name: event },
          inputs: { verify_only: verifyOnly },
        }),
        event !== 'workflow_dispatch' || !verifyOnly,
      );
    }
  }
  const verifier = readFileSync('scripts/verify-deployment.mjs', 'utf8');
  assert.match(verifier, /\/api\/health/);
  assert.match(verifier, /\/api\/reactions/);
  const health = readFileSync('src/app/api/health/route.ts', 'utf8');
  assert.match(
    health,
    /process.env.RENDER_GIT_COMMIT\s*\|\|\s*process.env.GIT_COMMIT_SHA\s*\|\|\s*process.env.SOURCE_VERSION/,
  );
});
