discover-url - build and parse Kibana Discover URLs
================================================================================

`discover-url` builds [Kibana Discover][] URLs from a query (ES|QL, KQL, or
Lucene), a time range, filter pills, and layout settings like columns, sort,
and the histogram breakdown.  It can also parse an existing Discover URL back
into the command-line options, or the JavaScript object, that recreates it.

It's a single JavaScript file with no dependencies, which can be used:

- from the command line
- as a module from Node.js
- as a module in a web page, via `<script type="module">`

The file is typed with JSDoc comments and `// @ts-check`, so you get full
type checking when editing it, or code that uses it, in VS Code.

[Kibana Discover]: https://www.elastic.co/docs/explore-analyze/discover


install
================================================================================

    npm install -g pmuellr/discover-url

or run via

    npx pmuellr/discover-url --help

or add it as a dependency of your project

    npm install pmuellr/discover-url

Or just copy the script `discover-url.js` somewhere, as it requires no
dependencies.  Node.js 22.4 or later is required for the command line.


examples
================================================================================

See the [EXAMPLES.md][] file for examples that use ES|QL on the Kibana event
log.


parsing an existing Discover URL
================================================================================

Set up a Discover page by hand, copy its URL, and `--parse` prints the command
that recreates it.  Discover URLs contain `'`, `!`, and `$`, so quoting them in
the shell is tedious; use `--parse -` to read the URL from stdin instead.

See the [EXAMPLES.md][] file for an example.

`--output json` prints the parameters object for `buildDiscoverUrl()`
instead, which can be edited and passed back with `--params`:

    pbpaste | discover-url --parse - --output json > task-runs.json
    discover-url --params task-runs.json --from now-7d

Filters that can't be expressed with the filter options (for example, a
filter with a custom label) are printed as `--filter-json`, so nothing is lost.
URL state that `discover-url` doesn't support is reported as a warning on
stderr.


usage
================================================================================

    usage: discover-url [options]

    Prints a Kibana Discover URL built from the options.

    connection:
      --kibana URL              Kibana base URL incl. base path ($KIBANA_URL, default http://localhost:5601)
      --space ID                Kibana space id
      --params FILE             JSON file (or - for stdin) with DiscoverUrlParams; options override it
      --open                    also open the URL in the browser

    parsing an existing URL:
      --parse URL               print the options for an existing Discover URL, #/... fragment,
                                or _a=...&_g=... query string (- reads it from stdin)
      --output FORMAT           with --parse: args (command-line options, default) or
                                json (the DiscoverUrlParams object for buildDiscoverUrl / --params)

    query and data:
      --esql QUERY              ES|QL query (switches to ES|QL mode)
      --kql QUERY               KQL query
      --lucene QUERY            Lucene query
      --data-view ID            data view id (not used with --esql)
      --saved-query ID          saved query id
      --saved-search ID         open a saved Discover session
      --session ID              search session id
      --tab-id ID               Discover tab id
      --tab-label LABEL         Discover tab label

    time:
      --from TIME               start time, e.g. now-24h or 2026-10-31T00:00:00Z (default now-15m if --to given)
      --to TIME                 end time (default now if --from given)
      --refresh MS              auto-refresh interval in ms (enables auto-refresh)
      --refresh-paused          set the refresh interval but leave auto-refresh paused
                                (interval defaults to 60000 when --refresh is not given)

    filters (repeatable):
      --filter FIELD=VALUE      "is" filter
      --filter-in FIELD=V1,V2   "is one of" filter
      --filter-range FIELD=A..B "is between" filter (gte A, lt B; either side may be empty)
      --filter-exists FIELD     "exists" filter
      --filter-dsl JSON         custom query DSL filter
      --filter-json JSON        raw Filter object or array of Filter objects (used as-is)
      --pin-filters             pin the filters given on the command line

      modifiers (any filter flag except --filter-json):
        FIELD!=VALUE         negate
        leading ^ or !       negate (! needs quoting in interactive shells; ^ does not in bash)
        leading %            add the filter disabled
      e.g. --filter %kibana.task.type!=alerting:.es-query   --filter-exists %^error.message
      filters get meta.index from --data-view (unless --esql is used)

    layout:
      --columns A,B,C           columns (repeatable)
      --sort FIELD[:asc|desc]   sort (repeatable, default desc)
      --grid JSON               data grid settings, e.g. '{"columns":{"message":{"width":400}}}'
      --interval INTERVAL       histogram interval (auto, ms, s, m, h, d, w, M, y)
      --breakdown FIELD         histogram breakdown field
      --view-mode MODE          documents | patterns | aggregated
      --hide-aggregated-preview hide field statistics previews
      --hide-chart              hide the histogram
      --hide-table              hide the documents table
      --hide-sidebar            collapse the field list
      --sample-size N           number of documents to fetch
      --rows-per-page N         grid rows per page
      --row-height N            row height in lines (--row-height=-1 for auto)
      --header-row-height N     header row height in lines (--header-row-height=-1 for auto)
      --density MODE            compact | normal | expanded
      --display-mode MODE       table | json
      --esql-approximation      approximate ES|QL execution
      --doc-id ID               open the document flyout for this document id
      --doc-index INDEX         index of the --doc-id document
      --doc-routing ROUTING     routing of the --doc-id document
      --profile-state JSON      profile URL state (_p)

      boolean options can be negated with --no-, e.g. --no-hide-chart writes hideChart:!f

      -h, --help                show this help


using as a module
================================================================================

#### Node.js

```js
import { buildDiscoverUrl, existsFilter, phraseFilter } from 'discover-url';

const url = buildDiscoverUrl({
  kibanaUrl: 'http://localhost:5601',
  timeRange: { from: 'now-1h', to: 'now' },
  esql: `FROM .kibana-event-log-*
    | EVAL delay_s = ROUND(kibana.task.schedule_delay / 1000000000.0, 3)
    | WHERE delay_s > 60
    | KEEP @timestamp, kibana.task.type, delay_s, error.message
    | SORT delay_s DESC`,
  filters: [
    phraseFilter('event.provider', 'taskManager'),
    phraseFilter('event.action', 'task-run'),
    existsFilter('error.message', { negate: true, disabled: true }),
  ],
  breakdownField: 'kibana.task.type',
});
```

#### web pages

The module only loads Node.js built-ins when it's run from the command line,
so it can be loaded directly in a browser.  Serve `discover-url.js` alongside
your page (browsers won't load modules from `file:` URLs):

```html
<a id="slow-rules">slow rule executions</a>

<script type="module">
  import { buildDiscoverUrl } from './discover-url.js';

  document.getElementById('slow-rules').href = buildDiscoverUrl({
    kibanaUrl: 'http://localhost:5601',
    timeRange: { from: 'now-24h', to: 'now' },
    esql: `FROM .kibana-event-log-*
      | WHERE event.provider == "alerting" AND event.action == "execute"
      | EVAL duration_s = ROUND(event.duration / 1000000000.0, 3)
      | SORT duration_s DESC
      | KEEP @timestamp, rule.name, duration_s
      | LIMIT 100`,
  });
</script>
```

#### exports

| export                                       | description
| -------------------------------------------- | ---------------------------------------------
| `buildDiscoverUrl(params)`                   | build a Discover URL
| `parseDiscoverUrl(url)`                      | parse a Discover URL into `{ params, warnings }`
| `paramsToArgs(params)`                       | convert `params` into command-line arguments
| `phraseFilter(field, value, options)`        | "is" filter pill
| `phrasesFilter(field, values, options)`      | "is one of" filter pill
| `rangeFilter(field, range, options)`         | "is between" filter pill
| `existsFilter(field, options)`               | "exists" filter pill
| `customFilter(query, options)`               | query DSL filter pill
| `risonEncode(value)` / `risonDecode(text)`   | the [rison][] encoding used in Discover URLs
| `encodeUriQuery(text)`                       | URL-encode a value the way Kibana does
| `paramsFromArgs(args)` / `main(args)`        | the command line (Node.js only)
| `DEFAULT_KIBANA_URL`                         | `http://localhost:5601`

The filter `options` are `negate`, `disabled`, `pinned`, `alias` (a custom
label for the pill), and `index` (the data view id, not needed with ES|QL).  See the `DiscoverUrlParams`
type at the bottom of `discover-url.js` for all the parameters.

[rison]: https://github.com/Nanonid/rison


development
================================================================================

Run the tests with

    npm test

which uses the Node.js test runner.  There are no dependencies to install.


change log
================================================================================

#### 2026-10-31 - 1.0.0

- initial version


references
================================================================================

Discover's URL format isn't a documented API, so `discover-url` follows the
Kibana source.  These are the places to look when Discover changes.

Kibana source, Discover's URL state:

- [`discover/common/constants.ts`][kb-constants] - the URL keys: `_a` (app
  state), `_g` (global state), `_p` (profile state), and `_tab`
- [`discover/common/app_locator.ts`][kb-locator] - `DiscoverAppLocatorParams`,
  the parameters Kibana itself uses to build Discover URLs, which
  `DiscoverUrlParams` is modeled on
- [`discover/common/app_locator_get_location.ts`][kb-locator-location] - how
  those parameters are written into the `_a`, `_g`, and `_tab` URL state
- [`discover/public/.../redux/types.ts`][kb-redux-types] - the types of the
  app state stored in `_a`, like `viewMode`, `density`, and `rowHeight`

Kibana source, encoding:

- [`kbn-rison`][kb-rison] - Kibana's rison encoder and decoder, which
  `risonEncode()` and `risonDecode()` match
- [`kibana_utils/common/url/encode_uri_query.ts`][kb-encode] - the URL
  encoding that `encodeUriQuery()` matches
- [`kibana_utils/common/state_management/set_state_to_kbn_url.ts`][kb-set-state] -
  how rison-encoded state is added to a Kibana URL

Kibana source, filters:

- [`kbn-es-query/src/filters/build_filters/`][kb-filters] - the `Filter` types,
  and Kibana's filter builders, which `phraseFilter()`, `phrasesFilter()`,
  `rangeFilter()`, `existsFilter()`, and `customFilter()` are modeled on

Kibana source, event log:

- [`event_log/README.md`][kb-event-log] - what the event log records, and
  its `event.duration` field in nanoseconds
- [`event_log/generated/mappings.json`][kb-event-log-mappings] - all the
  event log fields

Documentation:

- [Discover][Kibana Discover], [using ES|QL in Discover][docs-discover-esql],
  and [filtering][docs-filtering]
- the [ES|QL reference][docs-esql], including the
  [math functions][docs-esql-math] like `ROUND()`
- [rison][], the encoding used for Discover's URL state

[kb-constants]:          https://github.com/elastic/kibana/blob/main/src/platform/plugins/shared/discover/common/constants.ts
[kb-locator]:            https://github.com/elastic/kibana/blob/main/src/platform/plugins/shared/discover/common/app_locator.ts
[kb-locator-location]:   https://github.com/elastic/kibana/blob/main/src/platform/plugins/shared/discover/common/app_locator_get_location.ts
[kb-redux-types]:        https://github.com/elastic/kibana/blob/main/src/platform/plugins/shared/discover/public/application/main/state_management/redux/types.ts
[kb-rison]:              https://github.com/elastic/kibana/tree/main/src/platform/packages/shared/kbn-rison
[kb-encode]:             https://github.com/elastic/kibana/blob/main/src/platform/plugins/shared/kibana_utils/common/url/encode_uri_query.ts
[kb-set-state]:          https://github.com/elastic/kibana/blob/main/src/platform/plugins/shared/kibana_utils/common/state_management/set_state_to_kbn_url.ts
[kb-filters]:            https://github.com/elastic/kibana/tree/main/src/platform/packages/shared/kbn-es-query/src/filters/build_filters
[kb-event-log]:          https://github.com/elastic/kibana/blob/main/x-pack/platform/plugins/shared/event_log/README.md
[kb-event-log-mappings]: https://github.com/elastic/kibana/blob/main/x-pack/platform/plugins/shared/event_log/generated/mappings.json
[docs-discover-esql]:    https://www.elastic.co/docs/explore-analyze/discover/try-esql
[docs-filtering]:        https://www.elastic.co/docs/explore-analyze/query-filter/filtering
[docs-esql]:             https://www.elastic.co/docs/reference/query-languages/esql
[docs-esql-math]:        https://www.elastic.co/docs/reference/query-languages/esql/functions-operators/math-functions


license
================================================================================

This package is licensed under the MIT license.  See the [LICENSE.md][] file
for more information.


contributing
================================================================================

Awesome!  We're happy that you want to contribute.

Please read the [CONTRIBUTING.md][] file for more information.


[LICENSE.md]: LICENSE.md
[CONTRIBUTING.md]: CONTRIBUTING.md
[EXAMPLES.md]: EXAMPLES.md
