// @ts-check

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { encodeUriQuery, risonDecode, risonEncode } from '../discover-url.js';

describe('risonEncode', () => {
  it('encodes literals', () => {
    assert.equal(risonEncode(true), '!t');
    assert.equal(risonEncode(false), '!f');
    assert.equal(risonEncode(null), '!n');
  });

  it('returns undefined for values that cannot be encoded', () => {
    assert.equal(risonEncode(undefined), undefined);
    assert.equal(risonEncode(() => 1), undefined);
    assert.equal(risonEncode(Symbol('x')), undefined);
  });

  it('encodes numbers', () => {
    assert.equal(risonEncode(42), '42');
    assert.equal(risonEncode(-1), '-1');
    assert.equal(risonEncode(1.5), '1.5');
    assert.equal(risonEncode(1e21), '1e21');
    assert.equal(risonEncode(Infinity), '!n');
    assert.equal(risonEncode(NaN), '!n');
  });

  it('leaves id-like strings unquoted', () => {
    assert.equal(risonEncode('abc'), 'abc');
    assert.equal(risonEncode('kibana.task.type'), 'kibana.task.type');
    assert.equal(risonEncode('task-run'), 'task-run');
    assert.equal(risonEncode('now-24h/h'), 'now-24h/h');
    assert.equal(risonEncode('.kibana-event-log-ds'), '.kibana-event-log-ds');
  });

  it('quotes and escapes other strings', () => {
    assert.equal(risonEncode(''), "''");
    assert.equal(risonEncode('-x'), "'-x'");
    assert.equal(risonEncode('1abc'), "'1abc'");
    assert.equal(risonEncode('a b'), "'a b'");
    assert.equal(risonEncode('@timestamp'), "'@timestamp'");
    assert.equal(risonEncode('alerting:.es-query'), "'alerting:.es-query'");
    assert.equal(risonEncode("it's!"), "'it!'s!!'");
  });

  it('encodes arrays, dropping undefined items', () => {
    assert.equal(risonEncode([]), '!()');
    assert.equal(risonEncode([1, 'a', [true]]), '!(1,a,!(!t))');
    assert.equal(risonEncode([1, undefined]), '!(1)');
  });

  it('encodes objects with sorted keys, dropping undefined values', () => {
    assert.equal(risonEncode({}), '()');
    assert.equal(risonEncode({ b: 1, a: 2 }), '(a:2,b:1)');
    assert.equal(risonEncode({ a: undefined, b: null }), '(b:!n)');
    assert.equal(risonEncode({ $state: { store: 'appState' } }), "('$state':(store:appState))");
  });

  it('uses toJSON()', () => {
    assert.equal(risonEncode(new Date(0)), "'1970-01-01T00:00:00.000Z'");
  });
});

describe('risonDecode', () => {
  it('decodes literals, numbers, and strings', () => {
    assert.equal(risonDecode('!t'), true);
    assert.equal(risonDecode('!f'), false);
    assert.equal(risonDecode('!n'), null);
    assert.equal(risonDecode('-1.5e3'), -1500);
    assert.equal(risonDecode('abc'), 'abc');
    assert.equal(risonDecode("''"), '');
    assert.equal(risonDecode("'it!'s!!'"), "it's!");
  });

  it('decodes arrays and objects', () => {
    assert.deepEqual(risonDecode('!()'), []);
    assert.deepEqual(risonDecode('()'), {});
    assert.deepEqual(risonDecode("!(!('@timestamp',desc))"), [['@timestamp', 'desc']]);
    assert.deepEqual(risonDecode('(a:(b:!(1,2)),c:x)'), { a: { b: [1, 2] }, c: 'x' });
  });

  it('round-trips encoded values', () => {
    const values = [
      { query: { esql: 'FROM .kibana-event-log-* | WHERE message == "it\'s!"' } },
      { time: { from: 'now-24h/h', to: 'now' }, refreshInterval: { pause: true, value: 60000 } },
      [1, -2, 0.5, 'a b', '', null, true, false, [], {}],
    ];
    for (const value of values) {
      const encoded = risonEncode(value);
      assert.ok(encoded !== undefined);
      assert.deepEqual(risonDecode(encoded), value);
    }
  });

  it('throws on invalid input', () => {
    assert.throws(() => risonDecode(''), /unexpected end of input/);
    assert.throws(() => risonDecode('(a:1'), /expected "," or "\)"/);
    assert.throws(() => risonDecode('!x'), /unknown literal "!x"/);
    assert.throws(() => risonDecode("'abc"), /unterminated string/);
    assert.throws(() => risonDecode("'a!b'"), /invalid string escape/);
    assert.throws(() => risonDecode('(a:1)x'), /unexpected trailing characters/);
    assert.throws(() => risonDecode('(a)'), /expected ":"/);
  });
});

describe('encodeUriQuery', () => {
  it('encodes like Kibana, keeping @ : $ , ; readable', () => {
    assert.equal(encodeUriQuery("a b/c:@$,;'!()*|"), "a%20b%2Fc:@$,;'!()*%7C");
  });
});
