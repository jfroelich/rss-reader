import {for_each_active_feed} from '/src/operations/for-each-active-feed.js';
import {rdr_notify} from '/src/operations/rdr-notify.js';
import {rdr_poll_feed} from '/src/operations/rdr-poll-feed.js';

const null_console = {
  log: noop,
  warn: noop,
  debug: noop
};

const null_channel = {
  name: 'null-channel',
  postMessage: noop,
  close: noop
};

const default_options = {
  ignore_recency_check: false,
  ignore_modified_check: false,
  recency_period: 5 * 60 * 1000,
  fetch_feed_timeout: 5000,
  fetch_html_timeout: 5000,
  fetch_image_timeout: 3000,
  deactivation_threshold: 10,
  badge_update: true,
  notify: true
};

export async function rdr_poll_feeds(
    rconn, iconn, channel = null_channel, console = null_console,
    options = {}) {
  console.log('rdr_poll_feeds start');
  const feeds = [];
  await for_each_active_feed(rconn, feed => feeds.push(feed));
  console.debug('Loaded %d active feeds', feeds.length);
  const pfo = Object.assign({}, default_options, options);
  const pfp = rdr_poll_feed.bind(null, rconn, iconn, channel, console, pfo);
  const proms = feeds.map(pfp);
  const results = await Promise.all(proms);
  const count = results.reduce(accumulate_if_def, 0);
  show_poll_notification(count);
  console.log('rdr_poll_feeds end, added %d entries', count);
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
  rdr_notify(title, message);
}

function noop() {}
