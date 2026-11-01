// @ts-check

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import * as discoverUrlModule from '../discover-url.js';

const SOURCE = readFileSync(new URL('../discover-url.js', import.meta.url), 'utf8');
const NODE_ONLY = ['default', 'module.exports', 'paramsFromArgs', 'main'];

describe('discover-url.js as a <script src>', () => {
  /** @type {() => Record<string, unknown>} */
  function loadAsScript() {
    const context = {};
    runInNewContext(SOURCE.replace(/^#!.*/, ''), context);
    return context;
  }

  it('adds only the discoverUrl global', () => {
    assert.deepEqual(Object.keys(loadAsScript()), ['discoverUrl']);
  });

  it('has the same exports as the Node module, except the command line', () => {
    const { discoverUrl } = loadAsScript();
    const nodeExports = Object.keys(discoverUrlModule).filter((key) => !NODE_ONLY.includes(key));
    assert.deepEqual(Object.keys(/** @type {object} */ (discoverUrl)).sort(), nodeExports.sort());
  });

  it('builds URLs', () => {
    const { discoverUrl } = loadAsScript();
    const { buildDiscoverUrl } = /** @type {typeof discoverUrlModule} */ (discoverUrl);
    assert.equal(
      buildDiscoverUrl({ kibanaUrl: 'http://localhost:5601', tab: { label: 'x' } }),
      discoverUrlModule.buildDiscoverUrl({ kibanaUrl: 'http://localhost:5601', tab: { label: 'x' } })
    );
  });
});
