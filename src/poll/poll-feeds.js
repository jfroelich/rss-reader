import {notify} from '/src/notify.js';
import {poll_feed} from '/src/poll/poll-feed.js';
import {get_feeds} from '/src/db.js';

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

// Checks for new content
export async function poll_feeds(
    rconn, iconn, channel = null_channel, options = {}) {
  console.debug('Starting...');
  const feeds = await get_feeds(rconn, 'active', false);

  console.debug('%s: loaded %d active feeds', poll_feeds.name, feeds.length);
  const pfo = Object.assign({}, default_options, options);
  const pfp = poll_feed.bind(null, rconn, iconn, channel, pfo);
  const proms = feeds.map(pfp);
  const results = await Promise.all(proms);
  const count = results.reduce(accumulate_if_def, 0);
  show_poll_notification(count);
  console.debug('Added %d entries', count);
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
