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

See the [EXAMPLES.md][] file for examples that use KQL and filters on the
Kibana event log, including how to create the event log data view they use.


parsing an existing Discover URL
================================================================================

Set up a Discover page by hand, copy its URL, and `--parse` prints the command
that recreates it.  Discover URLs contain `'`, `!`, and `$`, so quoting them in
the shell is tedious; use `--parse -` to read the URL from stdin instead.

See the [EXAMPLES.md][] file for an example.

`--output json` prints the same options as JSON instead, which can be edited
and passed back with `--params`, or used as the parameters of
`buildDiscoverUrl()`.  The JSON keys are the option names in camelCase, in
the same order as the command line:

    pbpaste | discover-url --parse - --output json > task-runs.json
    discover-url --params task-runs.json --from now-7d

```json
{
  "kql": "",
  "dataView": ".kibana-event-log-ds",
  "from": "now-24h",
  "to": "now",
  "filters": [
    {"filter":"event.provider=taskManager"},
    {"filter":"%kibana.task.type!=alerting:.es-query"}
  ],
  "columns": ["kibana.task.type","kibana.task.schedule_delay"],
  "breakdown": "kibana.task.type"
}
```

Filters with a custom label are printed with `--filter-label`.  Filters that
can't be expressed with the filter options (for example, a phrase filter on a
number) are printed as `--filter-json`, so nothing is lost.
URL state that `discover-url` doesn't support is reported as a warning on
stderr.


usage
================================================================================

    usage: discover-url [options]

    Prints a Kibana Discover URL built from the options.

    connection:
      --kibana URL              Kibana base URL incl. base path ($KIBANA_URL, default http://localhost:5601)
      --space ID                Kibana space id
      --params FILE             JSON file (or - for stdin) with the options (see JSON below); options
                                override it, and filter options are added to its filters
      --open                    also open the URL in the browser

    parsing an existing URL:
      --parse URL               print the options for an existing Discover URL, #/... fragment,
                                or _a=...&_g=... query string (- reads it from stdin)
      --output FORMAT           with --parse: args (command-line options, default) or
                                json (the same options as JSON, for --params or buildDiscoverUrl())

    query and data:
      --esql QUERY              ES|QL query (switches to ES|QL mode)
      --kql QUERY               KQL query
      --lucene QUERY            Lucene query
      --data-view ID            data view id (not used with --esql)
      --saved-query ID          saved query id
      --saved-search ID         open a saved Discover session
      --session ID              search session id
      --tab-label LABEL         open the URL in a new Discover tab with this label
      --tab-id ID               select an open Discover tab (default new with --tab-label)

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
      --filter-label LABEL      custom label for the next filter option, e.g.
                                --filter-label Errors --filter-exists error.message
      --pin-filters             pin the filters given on the command line

      modifiers (any filter flag except --filter-json):
        FIELD!=VALUE         negate
        leading ^ or !       negate (! needs quoting in interactive shells; ^ does not in bash)
        leading %            add the filter disabled
      e.g. --filter %kibana.task.type!=alerting:.es-query   --filter-exists %^error.message
      filters get meta.index from --data-view, and can not be used with --esql

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

    JSON (--params, --output json, and buildDiscoverUrl()):
      the options as camelCase keys, e.g. --data-view X --hide-sidebar is
        {"dataView": "X", "hideSidebar": true}
      --columns and --sort are arrays; --grid and --profile-state are objects
      filters are an ordered array with one key per filter option, e.g.
        "filters": [{"filter": "event.provider=alerting"}, {"filterExists": "^error.message"}]
      with filterJson values as Filter objects instead of JSON strings, and --filter-label as a
      label key on the filter it applies to, e.g. {"filterExists": "error.message", "label": "Errors"}

      -h, --help                show this help


using as a module
================================================================================

#### Node.js

```js
import { buildDiscoverUrl } from 'discover-url';

const url = buildDiscoverUrl({
  tabLabel: 'Late task runs',
  kql: 'kibana.task.schedule_delay > 60000000000',
  dataView: '.kibana-event-log-ds',
  from: 'now-1h',
  filters: [{ filter: 'event.provider=taskManager' }, { filter: 'event.action=task-run' }],
  columns: ['kibana.task.type', 'kibana.task.schedule_delay', 'error.message'],
  breakdown: 'kibana.task.type',
});
```

The parameters are the command-line options in camelCase (see the JSON
section of the usage above), so `--parse URL --output json` prints them for an
existing Discover URL.

`const { buildDiscoverUrl } = require('discover-url')` works too.

#### web pages

The script only loads Node.js built-ins when it's run from the command line,
so it can be loaded directly in a browser with `<script src>`, which adds a
single `discoverUrl` global with the exports (except the command-line ones).
Put `discover-url.js` (or a symlink to it) next to your page.  This works for
pages opened from `file:` URLs as well as served ones; `discover-url.js` is a
CommonJS file rather than an ES module because browsers won't load ES modules
from `file:` URLs.

```html
<a id="slow-rules">slow rule executions</a>

<script src="discover-url.js"></script>
<script>
  const { buildDiscoverUrl } = discoverUrl;

  document.getElementById('slow-rules').href = buildDiscoverUrl({
    kibana: 'https://my-kibana.example.com',
    tabLabel: 'Slow rule runs',
    kql: 'event.duration > 10000000000',
    dataView: '.kibana-event-log-ds',
    from: 'now-24h',
    filters: [{ filter: 'event.provider=alerting' }, { filter: 'event.action=execute' }],
    columns: ['rule.name', 'event.duration'],
    sort: ['event.duration:desc'],
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
| `NEW_TAB_ID`                                 | `new`, the tab id that opens a new Discover tab

The `filters` parameter takes the filter options, like
`{ filter: 'event.provider=alerting' }` or
`{ filterExists: '^error.message', label: 'no errors' }`, or Filter objects
built by the filter functions, like
`{ filterJson: phraseFilter('event.provider', 'alerting', { alias: 'alerting' }) }`.
The filter function `options` are `negate`, `disabled`, `pinned`, `alias` (a
custom label for the pill), and `index` (the data view id; the filter options
use `dataView`).  Filter pills only work with KQL and Lucene queries; Discover
ignores them in ES|QL mode, so `buildDiscoverUrl()` throws an error when
they're combined with `esql`, and `parseDiscoverUrl()` drops them with a
warning.  See the `DiscoverUrlParams` type at the bottom of `discover-url.js`
for all the parameters.

[rison]: https://github.com/Nanonid/rison


development
================================================================================

Run the tests with

    npm test

which uses the Node.js test runner.  There are no dependencies to install.


change log
================================================================================

#### 2026-10-31 - 2.0.0

- breaking: the `buildDiscoverUrl()` parameters, `parseDiscoverUrl()` params,
  and `--params` / `--output json` JSON are now the command-line options in
  camelCase and command-line order, e.g. `kibana`, `space`, `tabLabel`,
  `from` / `to`, `refresh` / `refreshPaused`, `breakdown`, and `sort` as
  `"field:dir"` strings
- breaking: `filters` are the filter options, e.g. `{ filter: 'a=b' }`, with
  Filter objects as `{ filterJson: filter }`; `pinFilters` pins them, and they
  get their data view from `dataView`
- breaking: the `query` parameter is removed; use `esql`, `kql`, or `lucene`
- `--filter-label` (`label` in JSON) sets a filter's custom label, so
  `--parse` no longer falls back to `--filter-json` for labeled filters
- `--parse` ignores the `meta.field` and `meta.value` fields Kibana's filter
  editor adds, so filters created in Discover print as filter options
- unknown parameters are an error
- filter options on the command line are added to the `--params` filters
- breaking: `discover-url.js` is now a CommonJS file, so web pages opened from
  `file:` URLs can load it with `<script src>`; it adds a `discoverUrl`
  global.  Web pages can no longer load it with `import`.

#### 2026-10-31 - 1.1.0

- filters with an ES|QL query are now an error, since Discover ignores them
- `--tab-label` opens a new tab without needing `--tab-id`
- the examples use KQL and a data view, with instructions to create it

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
- the [data views API][docs-data-views-api], used to create the event log
  data view in the examples
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
[docs-data-views-api]:   https://www.elastic.co/docs/api/doc/kibana/group/endpoint-data-views
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
