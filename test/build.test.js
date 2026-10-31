// @ts-check

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  DEFAULT_KIBANA_URL,
  buildDiscoverUrl,
  customFilter,
  existsFilter,
  phraseFilter,
  phrasesFilter,
  rangeFilter,
} from '../discover-url.js';
import {
  EVENT_LOG_DATA_VIEW,
  EVENT_LOG_ESQL,
  EVENT_LOG_PARAMS,
  EVENT_LOG_URL_REBUILT,
  KIBANA_URL,
} from './fixtures.js';

const DISCOVER = `${KIBANA_URL}/app/discover#/`;

describe('buildDiscoverUrl', () => {
  /** @type {string | undefined} */
  let savedKibanaUrl;
  beforeEach(() => {
    savedKibanaUrl = process.env.KIBANA_URL;
    delete process.env.KIBANA_URL;
  });
  afterEach(() => {
    if (savedKibanaUrl === undefined) delete process.env.KIBANA_URL;
    else process.env.KIBANA_URL = savedKibanaUrl;
  });

  it('defaults to the local Kibana', () => {
    assert.equal(DEFAULT_KIBANA_URL, KIBANA_URL);
    assert.equal(buildDiscoverUrl(), DISCOVER);
  });

  it('uses $KIBANA_URL when kibanaUrl is not given', () => {
    process.env.KIBANA_URL = 'https://kb.example.com';
    assert.equal(buildDiscoverUrl(), 'https://kb.example.com/app/discover#/');
  });

  it('handles base paths, spaces, saved sessions, and search sessions', () => {
    const url = buildDiscoverUrl({
      kibanaUrl: 'https://kb.example.com/xyz/',
      spaceId: 'dev',
      savedSearchId: 'abc',
      searchSessionId: 's1',
    });
    assert.equal(url, 'https://kb.example.com/xyz/s/dev/app/discover#/view/abc?searchSessionId=s1');
  });

  it('opens a new tab when the tab has a label but no id', () => {
    assert.equal(
      buildDiscoverUrl({ kibanaUrl: KIBANA_URL, tab: { label: 'Slow rules' } }),
      `${DISCOVER}?_tab=(tabId:new,tabLabel:'Slow%20rules')`
    );
  });

  it('omits the default space', () => {
    assert.equal(buildDiscoverUrl({ kibanaUrl: KIBANA_URL, spaceId: 'default' }), DISCOVER);
  });

  it('builds ES|QL URLs', () => {
    const url = buildDiscoverUrl({
      kibanaUrl: KIBANA_URL,
      esql: EVENT_LOG_ESQL,
      timeRange: { from: 'now-7d', to: 'now' },
    });
    assert.equal(
      url,
      `${DISCOVER}?_g=(time:(from:now-7d,to:now))` +
        "&_a=(dataSource:(type:esql),query:(esql:'FROM%20.kibana-event-log-*%20%7C%20WHERE%20" +
        "event.provider%20%3D%3D%20%22alerting%22%20%7C%20LIMIT%20100'))"
    );
  });

  it('builds KQL and Lucene URLs with a data view', () => {
    assert.equal(
      buildDiscoverUrl({ kibanaUrl: KIBANA_URL, kql: 'event.outcome: failure', dataViewId: EVENT_LOG_DATA_VIEW }),
      `${DISCOVER}?_a=(dataSource:(dataViewId:.kibana-event-log-ds,type:dataView),` +
        "query:(language:kuery,query:'event.outcome:%20failure'))"
    );
    assert.equal(
      buildDiscoverUrl({ kibanaUrl: KIBANA_URL, lucene: 'rule.id:abc' }),
      `${DISCOVER}?_a=(query:(language:lucene,query:'rule.id:abc'))`
    );
  });

  it('ignores the data view in ES|QL mode', () => {
    assert.equal(
      buildDiscoverUrl({ kibanaUrl: KIBANA_URL, esql: 'FROM x', dataViewId: EVENT_LOG_DATA_VIEW }),
      `${DISCOVER}?_a=(dataSource:(type:esql),query:(esql:'FROM%20x'))`
    );
  });

  it('rejects filters in ES|QL mode', () => {
    assert.throws(
      () => buildDiscoverUrl({ esql: 'FROM x', filters: [existsFilter('error.message')] }),
      /filters can not be used with an ES\|QL query/
    );
  });

  it('rejects more than one query', () => {
    assert.throws(
      () => buildDiscoverUrl({ esql: 'FROM x', kql: 'a' }),
      /only one of esql, kql, lucene, or query/
    );
  });

  it('builds the event log URL copied from Discover', () => {
    assert.equal(buildDiscoverUrl(EVENT_LOG_PARAMS), EVENT_LOG_URL_REBUILT);
  });

  it('puts pinned filters in _g and the rest in _a', () => {
    const url = buildDiscoverUrl({
      kibanaUrl: KIBANA_URL,
      filters: [phraseFilter('event.provider', 'alerting', { pinned: true }), existsFilter('error.message')],
    });
    assert.match(url, /_g=\(filters:!\(\('\$state':\(store:globalState\),meta:\(.*key:event\.provider/);
    assert.match(url, /_a=\(filters:!\(\('\$state':\(store:appState\),meta:\(.*key:error\.message/);
  });

  it('writes layout options', () => {
    const url = buildDiscoverUrl({
      kibanaUrl: KIBANA_URL,
      columns: ['rule.name', 'event.duration'],
      sort: [['event.duration', 'desc']],
      grid: { columns: { 'rule.name': { width: 300 } } },
      hideChart: true,
      sampleSize: 1000,
      rowHeight: -1,
      density: 'compact',
      documentsDisplayMode: 'json',
      viewMode: 'documents',
      expandedDoc: { id: 'd1', index: '.ds-.kibana-event-log-ds-2026.10.31-000001' },
      tab: { id: 't1', label: 'My tab' },
      profileState: { foo: 'bar' },
    });
    assert.equal(
      url,
      `${DISCOVER}?_tab=(tabId:t1,tabLabel:'My%20tab')` +
        '&_a=(columns:!(rule.name,event.duration),density:compact,documentsDisplayMode:json,' +
        "expandedDoc:(id:d1,index:.ds-.kibana-event-log-ds-2026.10.31-000001),grid:(columns:(rule.name:(width:300)))," +
        'hideChart:!t,rowHeight:-1,sampleSize:1000,sort:!(!(event.duration,desc)),viewMode:documents)' +
        '&_p=(foo:bar)'
    );
  });

  it('omits a sample size of zero', () => {
    assert.equal(buildDiscoverUrl({ kibanaUrl: KIBANA_URL, sampleSize: 0 }), DISCOVER);
  });
});

describe('filter builders', () => {
  it('phraseFilter', () => {
    assert.deepEqual(phraseFilter('event.action', 'execute'), {
      meta: { alias: null, disabled: false, negate: false, key: 'event.action', type: 'phrase', params: { query: 'execute' } },
      query: { match_phrase: { 'event.action': 'execute' } },
      $state: { store: 'appState' },
    });
  });

  it('phrasesFilter', () => {
    assert.deepEqual(phrasesFilter('event.outcome', ['failure', 'unknown']), {
      meta: { alias: null, disabled: false, negate: false, key: 'event.outcome', type: 'phrases', params: ['failure', 'unknown'] },
      query: {
        bool: {
          minimum_should_match: 1,
          should: [
            { match_phrase: { 'event.outcome': 'failure' } },
            { match_phrase: { 'event.outcome': 'unknown' } },
          ],
        },
      },
      $state: { store: 'appState' },
    });
  });

  it('rangeFilter', () => {
    assert.deepEqual(rangeFilter('event.duration', { gte: 1e9 }), {
      meta: { alias: null, disabled: false, negate: false, key: 'event.duration', type: 'range', params: { gte: 1e9 } },
      query: { range: { 'event.duration': { gte: 1e9 } } },
      $state: { store: 'appState' },
    });
  });

  it('existsFilter', () => {
    assert.deepEqual(existsFilter('error.message'), {
      meta: { alias: null, disabled: false, negate: false, key: 'error.message', type: 'exists', value: 'exists' },
      query: { exists: { field: 'error.message' } },
      $state: { store: 'appState' },
    });
  });

  it('customFilter', () => {
    const query = { query_string: { query: 'rule.name:*cpu*' } };
    assert.deepEqual(customFilter(query), {
      meta: { alias: null, disabled: false, negate: false, key: 'query', type: 'custom', value: JSON.stringify(query) },
      query,
      $state: { store: 'appState' },
    });
  });

  it('applies filter options', () => {
    const { meta, $state } = existsFilter('error.message', {
      negate: true,
      disabled: true,
      pinned: true,
      alias: 'has errors',
      index: EVENT_LOG_DATA_VIEW,
    });
    assert.deepEqual(meta, {
      alias: 'has errors',
      disabled: true,
      negate: true,
      index: EVENT_LOG_DATA_VIEW,
      key: 'error.message',
      type: 'exists',
      value: 'exists',
    });
    assert.deepEqual($state, { store: 'globalState' });
  });
});
