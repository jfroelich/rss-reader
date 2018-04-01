import {find_active_feeds} from '/src/operations/find-active-feeds.js';
import {rdr_badge_refresh} from '/src/operations/rdr-badge-refresh.js';
import {rdr_notify} from '/src/operations/rdr-notify.js';
import {rdr_poll_feed} from '/src/operations/rdr-poll-feed.js';

const null_console = {
  log: noop,
  warn: noop,
  debug: noop
};

const null_channel = {
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
  console.log('Polling feeds...');

  const feeds = await find_active_feeds(rconn);

  const pfo = Object.assign({}, default_options, options);
  const pfp = rdr_poll_feed.bind(null, rconn, iconn, channel, console, pfo);
  const proms = feeds.map(pfp);
  const results = await Promise.all(proms);
  const count =
      results.reduce((sum, value) => isNaN(value) ? sum : sum + value, 0);

  if (count) {
    rdr_badge_refresh(rconn, console).catch(console.error);

    const title = 'Added articles';
    const message = 'Added articles';
    rdr_notify(title, message);
  }

  console.log('Poll feeds completed, added %d entries', count);
}

function noop() {}
