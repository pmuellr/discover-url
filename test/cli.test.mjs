// @ts-check

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildDiscoverUrl, existsFilter, paramsFromArgs, phraseFilter } from '../discover-url.js';
import {
  EVENT_LOG_ARGS,
  EVENT_LOG_DATA_VIEW,
  EVENT_LOG_ESQL,
  EVENT_LOG_PARAMS,
  EVENT_LOG_URL,
  EVENT_LOG_URL_REBUILT,
  KIBANA_URL,
} from './fixtures.mjs';

const SCRIPT = fileURLToPath(new URL('../discover-url.js', import.meta.url));

/** @type {(args: string[], input?: string) => { status: number | null; stdout: string; stderr: string }} */
function run(args, input) {
  const { KIBANA_URL: _ignored, ...env } = process.env;
  const { status, stdout, stderr } = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env,
    input,
  });
  return { status, stdout, stderr };
}

describe('discover-url.js command line', () => {
  it('prints the help', () => {
    const { status, stdout } = run(['--help']);
    assert.equal(status, 0);
    assert.match(stdout, /^usage: discover-url\.js \[options\]/);
    assert.match(stdout, /--parse URL/);
  });

  it('prints a URL for the given options', () => {
    const { status, stdout, stderr } = run(['--esql', EVENT_LOG_ESQL, '--from', 'now-7d']);
    assert.equal(stderr, '');
    assert.equal(status, 0);
    assert.equal(
      stdout,
      `${buildDiscoverUrl({ kibana: KIBANA_URL, esql: EVENT_LOG_ESQL, from: 'now-7d' })}\n`
    );
  });

  it('recreates the event log URL copied from Discover', () => {
    const { status, stdout } = run(EVENT_LOG_ARGS);
    assert.equal(status, 0);
    assert.equal(stdout, `${EVENT_LOG_URL_REBUILT}\n`);
  });

  it('keeps filters in command-line order', async () => {
    const params = await paramsFromArgs([
      '--data-view', EVENT_LOG_DATA_VIEW,
      '--filter-exists', 'error.message',
      '--filter', 'event.provider=alerting',
      '--filter-exists', '^kibana.alerting.outcome',
    ]);
    assert.deepEqual(params.filters, [
      { filterExists: 'error.message' },
      { filter: 'event.provider=alerting' },
      { filterExists: '^kibana.alerting.outcome' },
    ]);
  });

  it('labels the next filter with --filter-label', async () => {
    const params = await paramsFromArgs([
      '--filter-label', 'Errors', '--filter-exists', 'error.message',
      '--filter', 'event.provider=alerting',
    ]);
    assert.deepEqual(params.filters, [{ filterExists: 'error.message', label: 'Errors' }, { filter: 'event.provider=alerting' }]);
    assert.equal(
      buildDiscoverUrl(params),
      buildDiscoverUrl({ filters: [{ filterJson: existsFilter('error.message', { alias: 'Errors' }) }, { filter: 'event.provider=alerting' }] })
    );
  });

  it('adds --filter-json filters as objects', async () => {
    const filter = existsFilter('error.message');
    const params = await paramsFromArgs(['--filter-json', JSON.stringify(filter)]);
    assert.deepEqual(params.filters, [{ filterJson: filter }]);
  });

  it('adds filter options to the --params filters', () => {
    const { status, stdout } = run(['--params', '-', '--filter', 'a=b'], JSON.stringify(EVENT_LOG_PARAMS));
    assert.equal(status, 0);
    const expected = buildDiscoverUrl({
      ...EVENT_LOG_PARAMS,
      filters: [...(EVENT_LOG_PARAMS.filters ?? []), { filter: 'a=b' }],
    });
    assert.equal(stdout, `${expected}\n`);
  });

  it('opens a new tab for --tab-label without --tab-id', () => {
    const { status, stdout } = run(['--tab-label', 'Slow rules']);
    assert.equal(status, 0);
    assert.equal(stdout, `${KIBANA_URL}/app/discover#/?_tab=(tabId:new,tabLabel:'Slow%20rules')\n`);
  });

  it('pins filters with --pin-filters', async () => {
    const params = await paramsFromArgs([
      '--data-view', EVENT_LOG_DATA_VIEW,
      '--pin-filters',
      '--filter', 'event.provider=alerting',
    ]);
    assert.equal(params.pinFilters, true);
    const url = buildDiscoverUrl(params);
    assert.deepEqual(
      url,
      buildDiscoverUrl({
        dataView: EVENT_LOG_DATA_VIEW,
        filters: [{ filterJson: phraseFilter('event.provider', 'alerting', { index: EVENT_LOG_DATA_VIEW, pinned: true }) }],
      })
    );
  });

  it('rejects filters with an ES|QL query from --esql or --params', () => {
    const fromEsql = run(['--esql', 'FROM .kibana-event-log-ds', '--filter', 'event.provider=alerting']);
    assert.equal(fromEsql.status, 1);
    assert.equal(fromEsql.stdout, '');
    assert.match(fromEsql.stderr, /filters can not be used with an ES\|QL query/);

    const fromParams = run(['--params', '-', '--esql', 'FROM .kibana-event-log-ds'], JSON.stringify(EVENT_LOG_PARAMS));
    assert.equal(fromParams.status, 1);
    assert.match(fromParams.stderr, /filters can not be used with an ES\|QL query/);
  });

  it('reads --params from a file and lets options override it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'discover-url-'));
    try {
      const file = join(dir, 'params.json');
      writeFileSync(file, JSON.stringify(EVENT_LOG_PARAMS));
      const { status, stdout } = run(['--params', file, '--from', 'now-1h', '--hide-chart']);
      assert.equal(status, 0);
      const expected = buildDiscoverUrl({
        ...EVENT_LOG_PARAMS,
        from: 'now-1h',
        hideChart: true,
      });
      assert.equal(stdout, `${expected}\n`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reads --params from stdin', () => {
    const { status, stdout } = run(['--params', '-'], JSON.stringify(EVENT_LOG_PARAMS));
    assert.equal(status, 0);
    assert.equal(stdout, `${EVENT_LOG_URL_REBUILT}\n`);
  });

  it('reports errors with exit code 1', () => {
    for (const [args, message] of [
      [['--bogus'], /Unknown option '--bogus'/],
      [['--esql', 'FROM x', '--kql', 'a'], /only one of esql, kql, or lucene may be specified/],
      [['--density', 'huge'], /--density: expected one of compact, normal, expanded, got "huge"/],
      [['--sample-size', 'many'], /--sample-size: expected an integer, got "many"/],
      [['--filter', 'no-equals'], /--filter: expected FIELD=VALUE, got "no-equals"/],
      [['--doc-id', 'd1'], /--doc-id and --doc-index must be used together/],
      [['--filter', 'a=b', '--filter-label', 'x'], /--filter-label must be followed by a filter option/],
      [['--filter-label', 'x', '--filter-label', 'y', '--filter', 'a=b'], /--filter-label must be followed by a filter option/],
      [['--filter-label', 'x', '--filter-json', '{"meta":{}}'], /--filter-label can not be used with --filter-json/],
      [['--output', 'json'], /--output requires --parse/],
    ]) {
      const { status, stdout, stderr } = run(/** @type {string[]} */ (args));
      assert.equal(status, 1);
      assert.equal(stdout, '');
      assert.match(stderr, /** @type {RegExp} */ (message));
    }
  });
});

describe('discover-url.js --parse', () => {
  it('prints the command line for a URL', () => {
    const { status, stdout, stderr } = run(['--parse', EVENT_LOG_URL]);
    assert.equal(stderr, '');
    assert.equal(status, 0);
    assert.equal(
      stdout,
      [
        'discover-url.js \\',
        '  --tab-id 58335e51-bd2d-4b6f-a06c-e044f058c525 \\',
        "  --kql '' \\",
        '  --data-view .kibana-event-log-ds \\',
        '  --from now-24h/h \\',
        '  --to now \\',
        '  --refresh-paused \\',
        '  --filter event.provider=taskManager \\',
        '  --filter event.action=task-run \\',
        "  --filter '%kibana.task.type!=alerting:.es-query' \\",
        '  --columns kibana.task.type,kibana.task.schedule_delay \\',
        '  --sort @timestamp:desc \\',
        '  --interval auto \\',
        '  --breakdown kibana.task.type \\',
        '  --no-hide-chart \\',
        '  --no-hide-table \\',
        '  --hide-sidebar',
        '',
      ].join('\n')
    );
  });

  it('shell-quotes values', () => {
    const url = buildDiscoverUrl({ esql: "FROM x | WHERE message == \"it's!\"" });
    const { stdout } = run(['--parse', url]);
    assert.equal(stdout, `discover-url.js \\\n  --esql 'FROM x | WHERE message == "it'\\''s!"'\n`);
  });

  it('prints the params as JSON, which --params accepts', () => {
    const parsed = run(['--parse', EVENT_LOG_URL, '--output', 'json']);
    assert.equal(parsed.status, 0);
    assert.deepEqual(JSON.parse(parsed.stdout), EVENT_LOG_PARAMS);

    const rebuilt = run(['--params', '-'], parsed.stdout);
    assert.equal(rebuilt.stdout, `${EVENT_LOG_URL_REBUILT}\n`);
  });

  it('reads the URL from stdin with --parse -', () => {
    const { status, stdout } = run(['--parse', '-', '--output', 'json'], `${EVENT_LOG_URL}\n`);
    assert.equal(status, 0);
    assert.deepEqual(JSON.parse(stdout), EVENT_LOG_PARAMS);
  });

  it('prints warnings to stderr', () => {
    const { status, stdout, stderr } = run(['--parse', '#/?_a=(hideChart:!t,jsonModeSettings:(x:1))']);
    assert.equal(status, 0);
    assert.equal(stdout, 'discover-url.js \\\n  --hide-chart\n');
    assert.equal(stderr, 'discover-url: warning: ignored _a.jsonModeSettings (not supported by discover-url)\n');
  });

  it('rejects other options and unknown output formats', () => {
    const combined = run(['--parse', EVENT_LOG_URL, '--hide-chart']);
    assert.equal(combined.status, 1);
    assert.match(combined.stderr, /--parse can only be combined with --output \(got --hide-chart\)/);

    const format = run(['--parse', EVENT_LOG_URL, '--output', 'yaml']);
    assert.equal(format.status, 1);
    assert.match(format.stderr, /--output: expected one of args, json, got "yaml"/);
  });

  it('rejects --parse in paramsFromArgs()', async () => {
    await assert.rejects(paramsFromArgs(['--parse', EVENT_LOG_URL]), /--parse is only supported by main\(\)/);
  });
});
