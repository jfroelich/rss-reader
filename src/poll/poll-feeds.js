import {db_for_each_active_feed} from '/src/db/db-for-each-active-feed.js';
import {console_stub} from '/src/lib/console-stub.js';
import {notify} from '/src/notify.js';
import {poll_feed} from '/src/poll/poll-feed.js';

const null_channel = {
  name: 'null-channel',
  postMessage: noop,
  close: noop
};

const default_options = {
  ignore_recency_check: false,
  recency_period: 5 * 60 * 1000,
  fetch_feed_timeout: 5000,
  fetch_html_timeout: 5000,
  fetch_image_timeout: 3000,
  deactivation_threshold: 10,
  badge_update: true,
  notify: true
};

export async function poll_feeds(
    rconn, iconn, channel = null_channel, console = console_stub,
    options = {}) {
  console.log('%s: starting...', poll_feeds.name);
  const feeds = [];
  await db_for_each_active_feed(rconn, feed => feeds.push(feed));
  console.debug('%s: loaded %d active feeds', poll_feeds.name, feeds.length);
  const pfo = Object.assign({}, default_options, options);
  const pfp = poll_feed.bind(null, rconn, iconn, channel, console, pfo);
  const proms = feeds.map(pfp);
  const results = await Promise.all(proms);
  const count = results.reduce(accumulate_if_def, 0);
  show_poll_notification(count);
  console.log('poll_feeds end, added %d entries', count);
}

function accumulate_if_def(sum, value) {
  return isNaN(value) ? sum : sum + value;
}

function show_poll_notification(num_entries_added) {
  // Suppress if nothing added
  if (num_entries_added < 1) {
    return;
  }

  const title = 'Added articles';
  const message = 'Added articles';
  notify(title, message);
}

function noop() {}

/*
# poll-feeds
Checks for new content

### Params

### Errors

### Return value

### TODOS
* All database queries in poll-feeds should use a single database transaction so
as to guarantee data integrity.

*/
