// @ts-check

import { phraseFilter } from '../discover-url.js';

export const KIBANA_URL = 'http://localhost:5601';
export const EVENT_LOG_DATA_VIEW = '.kibana-event-log-ds';
export const EVENT_LOG_ESQL = 'FROM .kibana-event-log-* | WHERE event.provider == "alerting" | LIMIT 100';

/** Task Manager task runs from the event log, as copied from a Kibana Discover page. */
export const EVENT_LOG_URL =
  "http://localhost:5601/app/discover#/?_tab=(tabId:'58335e51-bd2d-4b6f-a06c-e044f058c525')" +
  '&_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-24h%2Fh,to:now))' +
  '&_a=(breakdownField:kibana.task.type,columns:!(kibana.task.type,kibana.task.schedule_delay),' +
  'dataSource:(dataViewId:.kibana-event-log-ds,type:dataView),filters:!(' +
  "('$state':(store:appState),meta:(alias:!n,disabled:!f,index:.kibana-event-log-ds,key:event.provider," +
  'negate:!f,params:(query:taskManager),type:phrase),query:(match_phrase:(event.provider:taskManager))),' +
  "('$state':(store:appState),meta:(alias:!n,disabled:!f,index:.kibana-event-log-ds,key:event.action," +
  'negate:!f,params:(query:task-run),type:phrase),query:(match_phrase:(event.action:task-run))),' +
  "('$state':(store:appState),meta:(alias:!n,disabled:!t,index:.kibana-event-log-ds,key:kibana.task.type," +
  "negate:!t,params:(query:'alerting:.es-query'),type:phrase)," +
  "query:(match_phrase:(kibana.task.type:'alerting:.es-query')))),hideChart:!f,hideSidebar:!t,hideTable:!f," +
  "interval:auto,query:(language:kuery,query:''),sort:!(!('@timestamp',desc)))";

/** EVENT_LOG_URL as rebuilt by buildDiscoverUrl(), which omits the empty `_g.filters`. */
export const EVENT_LOG_URL_REBUILT = EVENT_LOG_URL.replace('_g=(filters:!(),', '_g=(');

/** The DiscoverUrlParams that EVENT_LOG_URL parses into. */
export const EVENT_LOG_PARAMS = {
  kibanaUrl: KIBANA_URL,
  tab: { id: '58335e51-bd2d-4b6f-a06c-e044f058c525' },
  timeRange: { from: 'now-24h/h', to: 'now' },
  refreshInterval: { pause: true, value: 60000 },
  breakdownField: 'kibana.task.type',
  columns: ['kibana.task.type', 'kibana.task.schedule_delay'],
  dataViewId: EVENT_LOG_DATA_VIEW,
  filters: [
    phraseFilter('event.provider', 'taskManager', { index: EVENT_LOG_DATA_VIEW }),
    phraseFilter('event.action', 'task-run', { index: EVENT_LOG_DATA_VIEW }),
    phraseFilter('kibana.task.type', 'alerting:.es-query', {
      index: EVENT_LOG_DATA_VIEW,
      negate: true,
      disabled: true,
    }),
  ],
  hideChart: false,
  hideSidebar: true,
  hideTable: false,
  interval: 'auto',
  kql: '',
  sort: /** @type {Array<[string, 'asc' | 'desc']>} */ ([['@timestamp', 'desc']]),
};

/** The command-line arguments that recreate EVENT_LOG_URL. */
export const EVENT_LOG_ARGS = [
  '--tab-id', '58335e51-bd2d-4b6f-a06c-e044f058c525',
  '--kql', '',
  '--data-view', EVENT_LOG_DATA_VIEW,
  '--from', 'now-24h/h',
  '--to', 'now',
  '--refresh-paused',
  '--filter', 'event.provider=taskManager',
  '--filter', 'event.action=task-run',
  '--filter', '%kibana.task.type!=alerting:.es-query',
  '--columns', 'kibana.task.type,kibana.task.schedule_delay',
  '--sort', '@timestamp:desc',
  '--interval', 'auto',
  '--breakdown', 'kibana.task.type',
  '--no-hide-chart',
  '--no-hide-table',
  '--hide-sidebar',
];
