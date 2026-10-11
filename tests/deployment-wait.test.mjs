import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentReady, FRESHNESS_SLACK_MS } from '../scripts/deployment-wait.mjs';

const sha = 'f2f47c2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const other = 'b958d94bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

test('A GitHub-connected deploy is accepted only when the revision matches', () => {
  assert.equal(deploymentReady({ status: 200, revision: sha, expectRevision: sha }).ready, true);
  assert.equal(
    deploymentReady({ status: 200, revision: sha.slice(0, 7), expectRevision: sha }).ready,
    true,
  );
  assert.equal(
    deploymentReady({ status: 200, revision: sha, expectRevision: sha.slice(0, 7) }).ready,
    true,
  );
  const mismatch = deploymentReady({ status: 200, revision: other, expectRevision: sha });
  assert.equal(mismatch.ready, false);
  assert.match(mismatch.note, /لم يصل/);
});

test('An uploaded deploy without a commit is accepted when the container is fresh', () => {
  const deployedAt = '2026-10-11T03:00:00Z';
  const fresh = deploymentReady({
    status: 200,
    revision: '',
    startedAt: '2026-10-11T02:58:00Z',
    expectRevision: sha,
    deployedAt,
  });
  assert.equal(fresh.ready, true);
  assert.match(fresh.note, /حاوية حديثة/);
});

test('A stale container is not accepted as this run yet', () => {
  const stale = deploymentReady({
    status: 200,
    revision: '',
    startedAt: '2026-10-11T01:00:00Z',
    expectRevision: sha,
    deployedAt: '2026-10-11T03:00:00Z',
  });
  assert.equal(stale.ready, false);
  assert.match(stale.note, /أقدم من هذه النشرة/);
  // Exactly at the slack boundary is still accepted; one millisecond beyond is not.
  const boundary = (ageMs) =>
    deploymentReady({
      status: 200,
      revision: '',
      startedAt: new Date(Date.parse('2026-10-11T03:00:00Z') - ageMs).toISOString(),
      expectRevision: sha,
      deployedAt: '2026-10-11T03:00:00Z',
      slackMs: FRESHNESS_SLACK_MS,
    }).ready;
  assert.equal(boundary(FRESHNESS_SLACK_MS), true);
  assert.equal(boundary(FRESHNESS_SLACK_MS + 1), false);
});

test('Freshness comparison is skipped when the deploy step reported no time', () => {
  const verdict = deploymentReady({
    status: 200,
    revision: '',
    startedAt: '2020-01-01T00:00:00Z',
    expectRevision: sha,
    deployedAt: '',
  });
  assert.equal(verdict.ready, true);
  assert.match(verdict.note, /بلا شرط|دليلًا|مرجعية/);
});

test('Missing health response or a 404 keeps the verifier waiting', () => {
  const unreachable = deploymentReady({ status: null, expectRevision: sha });
  assert.equal(unreachable.ready, false);
  assert.match(unreachable.note, /تعذّر الوصول/);
  const legacy = deploymentReady({ status: 404, expectRevision: sha });
  assert.equal(legacy.ready, false);
  assert.match(legacy.note, /لا تتضمن \/api\/health/);
  const server = deploymentReady({ status: 503, expectRevision: sha });
  assert.equal(server.ready, false);
  assert.match(server.note, /503/);
});

test('Without an expected revision any healthy response is enough', () => {
  const verdict = deploymentReady({
    status: 200,
    revision: 'anything',
    startedAt: '2000-01-01T00:00:00Z',
  });
  assert.equal(verdict.ready, true);
  assert.match(verdict.note, /بلا شرط إصدار/);
});
