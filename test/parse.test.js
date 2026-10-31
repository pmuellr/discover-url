// @ts-check

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDiscoverUrl,
  customFilter,
  existsFilter,
  parseDiscoverUrl,
  paramsToArgs,
  phraseFilter,
  phrasesFilter,
  rangeFilter,
} from '../discover-url.js';
import {
  EVENT_LOG_ARGS,
  EVENT_LOG_DATA_VIEW,
  EVENT_LOG_ESQL,
  EVENT_LOG_PARAMS,
  EVENT_LOG_URL,
  KIBANA_URL,
} from './fixtures.js';

describe('parseDiscoverUrl', () => {
  it('parses the event log URL copied from Discover', () => {
    assert.deepEqual(parseDiscoverUrl(EVENT_LOG_URL), { params: EVENT_LOG_PARAMS, warnings: [] });
  });

  it('parses a #/... fragment', () => {
    const fragment = EVENT_LOG_URL.slice(EVENT_LOG_URL.indexOf('#'));
    const { kibanaUrl, ...params } = EVENT_LOG_PARAMS;
    assert.deepEqual(parseDiscoverUrl(fragment), { params, warnings: [] });
  });

  it('parses a bare query string', () => {
    assert.deepEqual(parseDiscoverUrl('_g=(time:(from:now-1h,to:now))&_a=(hideChart:!t)'), {
      params: { timeRange: { from: 'now-1h', to: 'now' }, hideChart: true },
      warnings: [],
    });
  });

  it('parses base paths, spaces, saved sessions, and search sessions', () => {
    const { params } = parseDiscoverUrl('https://kb.example.com/xyz/s/dev/app/discover#/view/abc?searchSessionId=s1');
    assert.deepEqual(params, {
      kibanaUrl: 'https://kb.example.com/xyz',
      spaceId: 'dev',
      savedSearchId: 'abc',
      searchSessionId: 's1',
    });
  });

  it('parses a URL without a hash', () => {
    assert.deepEqual(parseDiscoverUrl(`${KIBANA_URL}/app/discover`).params, { kibanaUrl: KIBANA_URL });
  });

  it('parses ES|QL queries', () => {
    const url = buildDiscoverUrl({ kibanaUrl: KIBANA_URL, esql: EVENT_LOG_ESQL });
    assert.deepEqual(parseDiscoverUrl(url).params, { kibanaUrl: KIBANA_URL, esql: EVENT_LOG_ESQL });
  });

  it('accepts the legacy index and flat sort forms', () => {
    const { params } = parseDiscoverUrl("#/?_a=(index:.kibana-event-log-ds,sort:!('@timestamp',asc))");
    assert.deepEqual(params, { dataViewId: EVENT_LOG_DATA_VIEW, sort: [['@timestamp', 'asc']] });
  });

  it('marks _g filters without $state as pinned', () => {
    const { params } = parseDiscoverUrl('#/?_g=(filters:!((meta:(key:a),query:(match_all:()))))');
    assert.deepEqual(params.filters, [
      { meta: { key: 'a' }, query: { match_all: {} }, $state: { store: 'globalState' } },
    ]);
  });

  it('warns about state it cannot represent', () => {
    const { params, warnings } = parseDiscoverUrl(
      "#/?_a=(jsonModeSettings:(x:1),density:huge,hideChart:yes,columns:!(1))&_g=(time:(from:1))&_x=1&_p=(a:"
    );
    assert.deepEqual(params, {});
    assert.deepEqual(warnings, [
      'ignored _a.jsonModeSettings (not supported by discover-url)',
      'ignored _a.density: unexpected value huge',
      'ignored _a.hideChart: unexpected value yes',
      'ignored _a.columns: unexpected value !(1)',
      'ignored _g.time: unexpected value (from:1)',
      'ignored URL parameter "_x"',
      'ignored _p: rison: unexpected end of input at position 3',
    ]);
  });

  it('warns about unrecognized paths and routes', () => {
    assert.deepEqual(parseDiscoverUrl('https://kb.example.com/app/dashboards#/').warnings, [
      'unrecognized URL path "https://kb.example.com/app/dashboards"',
    ]);
    assert.deepEqual(parseDiscoverUrl('#/foo?_a=()').warnings, ['unrecognized Discover route "foo"']);
  });

  it('round-trips URLs built by buildDiscoverUrl', () => {
    const urls = [
      buildDiscoverUrl({
        kibanaUrl: 'https://kb.example.com/xyz',
        spaceId: 'dev',
        savedSearchId: 'abc',
        searchSessionId: 's1',
        esql: "FROM .kibana-event-log-* | WHERE message == \"it's!\" | LIMIT 10",
        timeRange: { from: '2026-10-30T00:00:00.000Z', to: 'now' },
        refreshInterval: { pause: false, value: 5000 },
        filters: [
          phraseFilter('event.provider', 'alerting', { pinned: true }),
          phraseFilter('kibana.alert.rule.execution.metrics.number_of_searches', 2),
          existsFilter('error.message', { negate: true, disabled: true }),
          customFilter({ query_string: { query: 'rule.name:*cpu*' } }),
        ],
        rowHeight: -1,
        density: 'compact',
        expandedDoc: { id: 'd1', index: 'i1', routing: 'r1' },
        profileState: { foo: 'bar' },
        tab: { id: 't1', label: 'My tab' },
      }),
      buildDiscoverUrl({
        kibanaUrl: KIBANA_URL,
        dataViewId: EVENT_LOG_DATA_VIEW,
        lucene: 'event.outcome:failure',
        filters: [
          phrasesFilter('event.action', ['execute', 'execute-start'], { index: EVENT_LOG_DATA_VIEW }),
          rangeFilter('event.duration', { gte: 1e9, lt: 'x' }, { index: EVENT_LOG_DATA_VIEW }),
        ],
        columns: ['rule.name'],
        sort: [['event.duration', 'desc'], ['@timestamp', 'asc']],
        grid: { columns: { 'rule.name': { width: 300 } } },
        savedQuery: 'sq1',
        interval: 'h',
        viewMode: 'patterns',
        hideAggregatedPreview: true,
        hideTable: false,
        sampleSize: 500,
        headerRowHeight: 2,
        rowsPerPage: 100,
        documentsDisplayMode: 'table',
        esqlApproximation: false,
      }),
    ];
    for (const url of urls) {
      const { params, warnings } = parseDiscoverUrl(url);
      assert.deepEqual(warnings, []);
      assert.equal(buildDiscoverUrl(params), url);
    }
  });
});

describe('paramsToArgs', () => {
  it('converts the event log URL params into command-line arguments', () => {
    assert.deepEqual(paramsToArgs(EVENT_LOG_PARAMS), EVENT_LOG_ARGS);
  });

  it('omits the default Kibana URL and refresh interval', () => {
    assert.deepEqual(paramsToArgs({ kibanaUrl: KIBANA_URL, refreshInterval: { pause: true, value: 60000 } }), [
      '--refresh-paused',
    ]);
    assert.deepEqual(paramsToArgs({ kibanaUrl: 'https://kb', refreshInterval: { pause: false, value: 60000 } }), [
      '--kibana', 'https://kb',
      '--refresh', '60000',
    ]);
  });

  it('uses --name=value for values starting with "-"', () => {
    assert.deepEqual(paramsToArgs({ rowHeight: -1, kql: '-a' }), ['--kql=-a', '--row-height=-1']);
  });

  it('uses the filter flags when they reproduce the filter exactly', () => {
    const index = EVENT_LOG_DATA_VIEW;
    const args = paramsToArgs({
      dataViewId: index,
      filters: [
        phraseFilter('event.action', 'execute', { index, negate: true }),
        phrasesFilter('event.outcome', ['failure', 'unknown'], { index, disabled: true }),
        rangeFilter('event.duration', { gte: 1000000000 }, { index }),
        existsFilter('error.message', { index, negate: true, disabled: true }),
        customFilter({ query_string: { query: 'rule.name:*cpu*' } }, { index }),
      ],
    });
    assert.deepEqual(args, [
      '--data-view', index,
      '--filter', 'event.action!=execute',
      '--filter-in', '%event.outcome=failure,unknown',
      '--filter-range', 'event.duration=1000000000..',
      '--filter-exists', '%^error.message',
      '--filter-dsl', '{"query_string":{"query":"rule.name:*cpu*"}}',
    ]);
  });

  it('adds --pin-filters when every filter is pinned', () => {
    assert.deepEqual(paramsToArgs({ filters: [existsFilter('error.message', { pinned: true })] }), [
      '--pin-filters',
      '--filter-exists', 'error.message',
    ]);
  });

  it('falls back to --filter-json when the filter flags cannot reproduce a filter', () => {
    const pinned = phraseFilter('event.provider', 'alerting', { pinned: true });
    const numeric = phraseFilter('kibana.alert.rule.execution.metrics.number_of_searches', 2);
    const aliased = existsFilter('error.message', { alias: 'has errors' });
    assert.deepEqual(paramsToArgs({ filters: [pinned, numeric, aliased] }), [
      '--filter-json', JSON.stringify(pinned),
      '--filter-json', JSON.stringify(numeric),
      '--filter-json', JSON.stringify(aliased),
    ]);
  });
});
