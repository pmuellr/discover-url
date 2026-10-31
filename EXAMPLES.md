discover-url examples
================================================================================

Examples of using [discover-url][] from the command line.

The examples use ES|QL queries on the Kibana event log, the
`.kibana-event-log-*` indices that record rule executions, action executions,
and task runs.  No data view is needed.

Filter pills work in ES|QL mode too.  They're added on top of the query, and
can be edited, disabled, or removed in Discover without changing the query.

Durations in the event log, like `event.duration` and
`kibana.task.schedule_delay`, are stored in nanoseconds; the examples convert
them to seconds, to millisecond precision, with
`ROUND(field / 1000000000.0, 3)`.

The URLs below are for `http://localhost:5601`; use `--kibana` or the
`KIBANA_URL` environment variable for other Kibana servers.


#### the slowest rule executions over the last day

    discover-url --from now-24h --esql '
      FROM .kibana-event-log-*
      | WHERE event.provider == "alerting" AND event.action == "execute"
      | EVAL duration_s = ROUND(event.duration / 1000000000.0, 3)
      | SORT duration_s DESC
      | KEEP @timestamp, rule.name, event.outcome, duration_s
      | LIMIT 100'

#### failed rule executions over the last week, with filter pills

    discover-url \
      --from now-7d \
      --esql 'FROM .kibana-event-log-* | KEEP @timestamp, rule.name, event.outcome, error.message' \
      --filter event.provider=alerting \
      --filter event.action=execute \
      --filter event.outcome=failure

prints

    http://localhost:5601/app/discover#/?_g=(time:(from:now-7d,to:now))&_a=(dataSource:(type:esql),filters:!(('$state':(store:appState),meta:(alias:!n,disabled:!f,key:event.provider,negate:!f,params:(query:alerting),type:phrase),query:(match_phrase:(event.provider:alerting))),('$state':(store:appState),meta:(alias:!n,disabled:!f,key:event.action,negate:!f,params:(query:execute),type:phrase),query:(match_phrase:(event.action:execute))),('$state':(store:appState),meta:(alias:!n,disabled:!f,key:event.outcome,negate:!f,params:(query:failure),type:phrase),query:(match_phrase:(event.outcome:failure)))),query:(esql:'FROM%20.kibana-event-log-*%20%7C%20KEEP%20@timestamp,%20rule.name,%20event.outcome,%20error.message'))

Add `--open` to also open the URL in your browser.

#### task runs that started more than a minute late, broken down by task type

    discover-url \
      --from now-1h \
      --esql '
        FROM .kibana-event-log-*
        | WHERE event.provider == "taskManager" AND event.action == "task-run"
        | EVAL delay_s = ROUND(kibana.task.schedule_delay / 1000000000.0, 3)
        | WHERE delay_s > 60
        | KEEP @timestamp, kibana.task.type, delay_s
        | SORT delay_s DESC' \
      --breakdown kibana.task.type

#### a disabled filter pill

A leading `%` adds the filter pill disabled, so it can be turned on in
Discover with a click; a leading `^` negates it.  Here's a "does not exist"
filter on `error.message` that starts out disabled:

    discover-url \
      --from now-24h \
      --esql 'FROM .kibana-event-log-* | KEEP @timestamp, event.provider, event.action, message' \
      --filter-in event.action=execute,execute-action \
      --filter-exists %^error.message

#### a pinned filter, a space, and a remote Kibana

Pinned filters stay in place as you move between Kibana apps.

    discover-url \
      --kibana https://my-deployment.kb.us-east-1.aws.elastic.cloud \
      --space dev \
      --from now-7d \
      --esql 'FROM .kibana-event-log-* | WHERE event.outcome == "failure"' \
      --pin-filters \
      --filter rule.id=f0c0ce4a-2b1a-4c6b-9e0c-0e7a6e2b6b1e

#### parsing a Discover URL into a command line

With this URL of Task Manager task runs, which excludes the Elasticsearch
query rule tasks with a disabled filter, in the clipboard:

    http://localhost:5601/app/discover#/?_tab=(tabId:'58335e51-bd2d-4b6f-a06c-e044f058c525')&_g=(refreshInterval:(pause:!t,value:60000),time:(from:now-24h%2Fh,to:now))&_a=(breakdownField:kibana.task.type,dataSource:(type:esql),filters:!(('$state':(store:appState),meta:(alias:!n,disabled:!t,key:kibana.task.type,negate:!t,params:(query:'alerting:.es-query'),type:phrase),query:(match_phrase:(kibana.task.type:'alerting:.es-query')))),hideSidebar:!t,interval:auto,query:(esql:'FROM%20.kibana-event-log-*%20%7C%20WHERE%20event.provider%20%3D%3D%20%22taskManager%22%20AND%20event.action%20%3D%3D%20%22task-run%22%20%7C%20EVAL%20delay_s%20%3D%20ROUND(kibana.task.schedule_delay%20%2F%201000000000.0,%203)%20%7C%20KEEP%20@timestamp,%20kibana.task.type,%20delay_s'))

running this on macOS

    pbpaste | discover-url --parse -

prints

    discover-url \
      --tab-id 58335e51-bd2d-4b6f-a06c-e044f058c525 \
      --esql 'FROM .kibana-event-log-* | WHERE event.provider == "taskManager" AND event.action == "task-run" | EVAL delay_s = ROUND(kibana.task.schedule_delay / 1000000000.0, 3) | KEEP @timestamp, kibana.task.type, delay_s' \
      --from now-24h/h \
      --to now \
      --refresh-paused \
      --filter '%kibana.task.type!=alerting:.es-query' \
      --interval auto \
      --breakdown kibana.task.type \
      --hide-sidebar


[discover-url]: README.md
