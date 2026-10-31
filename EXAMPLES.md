discover-url examples
================================================================================

Examples of using [discover-url][] from the command line.

The examples use KQL queries and filter pills on the Kibana event log, the
`.kibana-event-log-ds` data stream that records rule executions, action
executions, and task runs.  Each example uses `--open` to open the URL in your
browser, as well as printing it, and `--tab-label` to open it in a new
Discover tab with that name.

A URL can only describe one tab, but each URL opened with `--tab-label` adds
a tab to the ones already open in Discover, so opening several of the
examples builds a page with several tabs.  Use Discover's Save button to keep
them together as a Discover session.

The URLs below are for `http://localhost:5601`; use `--kibana` or the
`KIBANA_URL` environment variable for other Kibana servers.


creating the event log data view
--------------------------------------------------------------------------------

The examples use a data view whose id and name are both
`.kibana-event-log-ds`.  Create it with Kibana's [data views API][]:

    curl -X POST http://localhost:5601/api/data_views/data_view \
      -u elastic \
      -H 'kbn-xsrf: true' \
      -H 'Content-Type: application/json' \
      -d '{
        "data_view": {
          "id": ".kibana-event-log-ds",
          "name": ".kibana-event-log-ds",
          "title": ".kibana-event-log-ds",
          "timeFieldName": "@timestamp",
          "fieldFormats": {
            "event.duration": {
              "id": "duration",
              "params": {
                "inputFormat": "nanoseconds",
                "outputFormat": "asMilliseconds",
                "outputPrecision": 0,
                "showSuffix": true,
                "useShortSuffix": true
              }
            },
            "kibana.task.schedule_delay": {
              "id": "duration",
              "params": {
                "inputFormat": "nanoseconds",
                "outputFormat": "asMilliseconds",
                "outputPrecision": 0,
                "showSuffix": true,
                "useShortSuffix": true
              }
            }
          }
        }
      }'

`-u elastic` prompts for the `elastic` user's password.

The durations in the event log, `event.duration` and
`kibana.task.schedule_delay`, are stored in nanoseconds; the field formats
display them in milliseconds, like `1234 ms`.

Data views belong to a space.  To create the data view in another space, add
the space to the path, like `/s/dev/api/data_views/data_view`.  If a data view
with that id already exists, the request fails; add `"override": true` next to
`"data_view"` to replace it.


#### the slowest rule executions over the last day

    discover-url --open \
      --tab-label 'Slow rule runs' \
      --data-view .kibana-event-log-ds \
      --from now-24h \
      --kql 'event.provider: alerting and event.action: execute' \
      --sort event.duration:desc \
      --columns rule.name,event.outcome,event.duration

prints

    http://localhost:5601/app/discover#/?_tab=(tabId:new,tabLabel:'Slow%20rule%20runs')&_g=(time:(from:now-24h,to:now))&_a=(columns:!(rule.name,event.outcome,event.duration),dataSource:(dataViewId:.kibana-event-log-ds,type:dataView),query:(language:kuery,query:'event.provider:%20alerting%20and%20event.action:%20execute'),sort:!(!(event.duration,desc)))

and opens it in your browser.

#### failed rule executions over the last week, broken down by rule

    discover-url --open \
      --tab-label 'Failed rule runs' \
      --data-view .kibana-event-log-ds \
      --from now-7d \
      --filter event.provider=alerting \
      --filter event.action=execute \
      --filter event.outcome=failure \
      --columns rule.name,error.message \
      --breakdown rule.name

#### the latest-starting task runs, broken down by task type

The `%` adds the last filter disabled, so it can be turned on in Discover to
exclude the Elasticsearch query rule tasks.

    discover-url --open \
      --tab-label 'Late task runs' \
      --data-view .kibana-event-log-ds \
      --from now-1h \
      --filter event.provider=taskManager \
      --filter event.action=task-run \
      --filter '%kibana.task.type!=alerting:.es-query' \
      --sort kibana.task.schedule_delay:desc \
      --columns kibana.task.type,kibana.task.schedule_delay \
      --breakdown kibana.task.type

#### rule executions that timed out, without the field list

    discover-url --open \
      --tab-label 'Rule timeouts' \
      --data-view .kibana-event-log-ds \
      --from now-7d \
      --kql 'event.provider: alerting and event.action: "execute-timeout"' \
      --columns rule.name,message \
      --breakdown rule.name \
      --hide-sidebar

#### a space and a remote Kibana, with a pinned filter

The data view needs to exist in the `dev` space.  Pinned filters stay in
place when you move to other Kibana apps.

    discover-url --open \
      --kibana https://my-deployment.kb.us-east-1.aws.elastic.cloud \
      --space dev \
      --tab-label 'Failures' \
      --data-view .kibana-event-log-ds \
      --from now-7d \
      --pin-filters \
      --filter event.outcome=failure \
      --columns event.provider,event.action,error.message \
      --breakdown event.provider

#### filters can't be used with ES|QL

Discover ignores filter pills in ES|QL mode, so `discover-url` reports an
error instead of building a URL that doesn't do what it looks like it does:

    discover-url \
      --esql 'FROM .kibana-event-log-ds' \
      --filter event.outcome=failure

prints

    discover-url: filters can not be used with an ES|QL query (Discover ignores them); use a WHERE command in the query instead
    run `discover-url --help` for usage

Put the condition in the query instead:
`--esql 'FROM .kibana-event-log-ds | WHERE event.outcome == "failure"'`.

#### parsing a Discover URL into a command line

With this URL of Task Manager task runs in the clipboard:

    http://localhost:5601/app/discover#/?_tab=(tabId:'58335e51-bd2d-4b6f-a06c-e044f058c525')&_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-24h%2Fh,to:now))&_a=(breakdownField:kibana.task.type,columns:!(kibana.task.type,kibana.task.schedule_delay),dataSource:(dataViewId:.kibana-event-log-ds,type:dataView),filters:!(('$state':(store:appState),meta:(alias:!n,disabled:!f,index:.kibana-event-log-ds,key:event.provider,negate:!f,params:(query:taskManager),type:phrase),query:(match_phrase:(event.provider:taskManager))),('$state':(store:appState),meta:(alias:!n,disabled:!f,index:.kibana-event-log-ds,key:event.action,negate:!f,params:(query:task-run),type:phrase),query:(match_phrase:(event.action:task-run))),('$state':(store:appState),meta:(alias:!n,disabled:!t,index:.kibana-event-log-ds,key:kibana.task.type,negate:!t,params:(query:'alerting:.es-query'),type:phrase),query:(match_phrase:(kibana.task.type:'alerting:.es-query')))),hideChart:!f,hideSidebar:!t,hideTable:!f,interval:auto,query:(language:kuery,query:''),sort:!(!('@timestamp',desc)))

running this on macOS

    pbpaste | discover-url --parse -

prints

    discover-url \
      --tab-id 58335e51-bd2d-4b6f-a06c-e044f058c525 \
      --kql '' \
      --data-view .kibana-event-log-ds \
      --from now-24h/h \
      --to now \
      --refresh-paused \
      --filter event.provider=taskManager \
      --filter event.action=task-run \
      --filter '%kibana.task.type!=alerting:.es-query' \
      --columns kibana.task.type,kibana.task.schedule_delay \
      --sort @timestamp:desc \
      --interval auto \
      --breakdown kibana.task.type \
      --no-hide-chart \
      --no-hide-table \
      --hide-sidebar

Add `--open` to the printed command to open the URL.


[discover-url]: README.md
[data views API]: https://www.elastic.co/docs/api/doc/kibana/group/endpoint-data-views
