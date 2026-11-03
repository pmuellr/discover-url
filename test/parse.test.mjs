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
} from './fixtures.mjs';

describe('parseDiscoverUrl', () => {
  it('parses the event log URL copied from Discover', () => {
    assert.deepEqual(parseDiscoverUrl(EVENT_LOG_URL), { params: EVENT_LOG_PARAMS, warnings: [] });
  });

  it('returns the params in command-line order', () => {
    const { params } = parseDiscoverUrl(EVENT_LOG_URL);
    assert.deepEqual(Object.keys(params), Object.keys(EVENT_LOG_PARAMS));
  });

  it('parses a #/... fragment', () => {
    const fragment = EVENT_LOG_URL.slice(EVENT_LOG_URL.indexOf('#'));
    assert.deepEqual(parseDiscoverUrl(fragment), { params: EVENT_LOG_PARAMS, warnings: [] });
  });

  it('parses a bare query string', () => {
    assert.deepEqual(parseDiscoverUrl('_g=(time:(from:now-1h,to:now))&_a=(hideChart:!t)'), {
      params: { from: 'now-1h', to: 'now', hideChart: true },
      warnings: [],
    });
  });

  it('parses base paths, spaces, saved sessions, and search sessions', () => {
    const { params } = parseDiscoverUrl('https://kb.example.com/xyz/s/dev/app/discover#/view/abc?searchSessionId=s1');
    assert.deepEqual(params, {
      kibana: 'https://kb.example.com/xyz',
      space: 'dev',
      savedSearch: 'abc',
      session: 's1',
    });
  });

  it('omits the default Kibana URL', () => {
    assert.deepEqual(parseDiscoverUrl(`${KIBANA_URL}/app/discover`).params, {});
  });

  it('parses ES|QL queries', () => {
    const url = buildDiscoverUrl({ esql: EVENT_LOG_ESQL });
    assert.deepEqual(parseDiscoverUrl(url).params, { esql: EVENT_LOG_ESQL });
  });

  it('drops filters from ES|QL URLs with a warning', () => {
    const { params, warnings } = parseDiscoverUrl(
      "#/?_g=(filters:!((meta:(key:a),query:(match_all:()))))&_a=(query:(esql:'FROM x'))"
    );
    assert.deepEqual(params, { esql: 'FROM x' });
    assert.deepEqual(warnings, ['ignored filters (Discover ignores them in ES|QL mode)']);
  });

  it('accepts the legacy index and flat sort forms', () => {
    const { params } = parseDiscoverUrl("#/?_a=(index:.kibana-event-log-ds,sort:!('@timestamp',asc))");
    assert.deepEqual(params, { dataView: EVENT_LOG_DATA_VIEW, sort: ['@timestamp:asc'] });
  });

  it('marks _g filters without $state as pinned', () => {
    const { params } = parseDiscoverUrl('#/?_g=(filters:!((meta:(key:a),query:(match_all:()))))');
    assert.deepEqual(params.filters, [
      { filterJson: { meta: { key: 'a' }, query: { match_all: {} }, $state: { store: 'globalState' } } },
    ]);
  });

  it('parses tabs, with a new tab as just the label', () => {
    assert.deepEqual(parseDiscoverUrl("#/?_tab=(tabId:new,tabLabel:'Slow rules')").params, { tabLabel: 'Slow rules' });
    assert.deepEqual(parseDiscoverUrl('#/?_tab=(tabId:new)').params, { tabId: 'new' });
    assert.deepEqual(parseDiscoverUrl('#/?_tab=(tabId:t1,tabLabel:x)').params, { tabId: 't1', tabLabel: 'x' });
  });

  it('parses the refresh interval', () => {
    const parse = (/** @type {string} */ state) => parseDiscoverUrl(`#/?_g=(refreshInterval:${state})`).params;
    assert.deepEqual(parse('(pause:!t,value:60000)'), { refreshPaused: true });
    assert.deepEqual(parse('(pause:!t,value:5000)'), { refresh: 5000, refreshPaused: true });
    assert.deepEqual(parse('(pause:!f,value:60000)'), { refresh: 60000 });
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
    const index = EVENT_LOG_DATA_VIEW;
    const urls = [
      buildDiscoverUrl({
        kibana: 'https://kb.example.com/xyz',
        space: 'dev',
        savedSearch: 'abc',
        session: 's1',
        tabId: 't1',
        tabLabel: 'My tab',
        kql: 'message: "it\'s!"',
        dataView: index,
        from: '2026-10-30T00:00:00.000Z',
        refresh: 5000,
        filters: [
          { filterJson: phraseFilter('event.provider', 'alerting', { index, pinned: true }) },
          { filterJson: phraseFilter('kibana.alert.rule.execution.metrics.number_of_searches', 2) },
          { filterExists: '%^error.message' },
          { filterDsl: '{"query_string":{"query":"rule.name:*cpu*"}}' },
        ],
        rowHeight: -1,
        density: 'compact',
        docId: 'd1',
        docIndex: 'i1',
        docRouting: 'r1',
        profileState: { foo: 'bar' },
      }),
      buildDiscoverUrl({
        dataView: index,
        lucene: 'event.outcome:failure',
        savedQuery: 'sq1',
        filters: [{ filterIn: 'event.action=execute,execute-start' }, { filterRange: 'event.duration=1000000000..x' }],
        columns: ['rule.name'],
        sort: ['event.duration:desc', '@timestamp:asc'],
        grid: { columns: { 'rule.name': { width: 300 } } },
        interval: 'h',
        viewMode: 'patterns',
        hideAggregatedPreview: true,
        hideTable: false,
        sampleSize: 500,
        rowsPerPage: 100,
        headerRowHeight: 2,
        displayMode: 'table',
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

  it('maps each param to its option', () => {
    assert.deepEqual(
      paramsToArgs({ hideChart: false, columns: ['a', 'b'], sort: ['a', 'b:asc'], grid: { x: 1 }, sampleSize: 10 }),
      ['--columns', 'a,b', '--sort', 'a', '--sort', 'b:asc', '--grid', '{"x":1}', '--no-hide-chart', '--sample-size', '10']
    );
  });

  it('puts --filter-label before the filter it labels', () => {
    assert.deepEqual(paramsToArgs({ filters: [{ filterExists: 'a', label: 'has a' }, { filter: 'b=c' }] }), [
      '--filter-label', 'has a', '--filter-exists', 'a',
      '--filter', 'b=c',
    ]);
  });

  it('uses --name=value for values starting with "-"', () => {
    assert.deepEqual(paramsToArgs({ rowHeight: -1, kql: '-a' }), ['--kql=-a', '--row-height=-1']);
  });

  it('puts the filters after --pin-filters, in order', () => {
    assert.deepEqual(
      paramsToArgs({
        filters: [{ filterExists: 'a' }, { filter: 'b=c' }, { filterJson: existsFilter('d') }],
        pinFilters: true,
        from: 'now-1h',
        columns: ['e'],
      }),
      [
        '--from', 'now-1h',
        '--pin-filters',
        '--filter-exists', 'a',
        '--filter', 'b=c',
        '--filter-json', JSON.stringify(existsFilter('d')),
        '--columns', 'e',
      ]
    );
  });
});

describe('parseDiscoverUrl filters', () => {
  /** @type {(filters: import('../discover-url.js').Filter[], dataView?: string) => import('../discover-url.js').DiscoverUrlParams} */
  function parseFilters(filters, dataView) {
    const url = buildDiscoverUrl({ dataView, filters: filters.map((filter) => ({ filterJson: filter })) });
    return parseDiscoverUrl(url).params;
  }

  it('uses the filter options when they reproduce the filter exactly', () => {
    const index = EVENT_LOG_DATA_VIEW;
    const { filters } = parseFilters(
      [
        phraseFilter('event.action', 'execute', { index, negate: true }),
        phrasesFilter('event.outcome', ['failure', 'unknown'], { index, disabled: true }),
        rangeFilter('event.duration', { gte: 1000000000 }, { index }),
        existsFilter('error.message', { index, negate: true, disabled: true }),
        customFilter({ query_string: { query: 'rule.name:*cpu*' } }, { index }),
      ],
      index
    );
    assert.deepEqual(filters, [
      { filter: 'event.action!=execute' },
      { filterIn: '%event.outcome=failure,unknown' },
      { filterRange: 'event.duration=1000000000..' },
      { filterExists: '%^error.message' },
      { filterDsl: '{"query_string":{"query":"rule.name:*cpu*"}}' },
    ]);
  });

  it('uses label for custom labels, and ignores the meta fields Kibana derives', () => {
    const index = 'logs-*';
    const labeled = phraseFilter('log.level', 'INFO', { index, alias: 'INFO', negate: true });
    const fromEditor = { ...labeled, meta: { ...labeled.meta, field: 'log.level' } };
    const custom = customFilter({ wildcard: { 'log.logger': 'plugins.reporting*' } }, { index, alias: 'Reporting' });
    const reformatted = { ...custom, meta: { ...custom.meta, value: '{ "wildcard": {} }' } };
    assert.deepEqual(parseFilters([fromEditor, reformatted], index).filters, [
      { filter: 'log.level!=INFO', label: 'INFO' },
      { filterDsl: '{"wildcard":{"log.logger":"plugins.reporting*"}}', label: 'Reporting' },
    ]);
  });

  it('sets pinFilters when every filter is pinned', () => {
    assert.deepEqual(parseFilters([existsFilter('error.message', { pinned: true })]), {
      pinFilters: true,
      filters: [{ filterExists: 'error.message' }],
    });
  });

  it('falls back to filterJson when the filter options cannot reproduce a filter, pinned filters first', () => {
    const pinned = phraseFilter('event.provider', 'alerting', { pinned: true });
    const numeric = phraseFilter('kibana.alert.rule.execution.metrics.number_of_searches', 2);
    const otherField = existsFilter('error.message');
    const scripted = { ...otherField, meta: { ...otherField.meta, field: 'error' } };
    assert.deepEqual(parseFilters([numeric, scripted, pinned]).filters, [
      { filterJson: pinned },
      { filterJson: numeric },
      { filterJson: scripted },
    ]);
  });
});
