import * as app from '/src/app/app.js';
import * as db from '/src/db/db.js';
import {poll_feed} from '/src/poll/poll-feed.js';

const chan_stub = {
  name: 'channel-stub',
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
    rconn, iconn, channel = chan_stub, options = {}) {
  const feeds = await db.get_feeds(rconn, 'active', false);
  console.debug('Loaded %d active feeds', feeds.length);
  const pfo = Object.assign({}, default_options, options);
  const pfp = poll_feed.bind(null, rconn, iconn, channel, pfo);

  const promises = [];
  for (const feed of feeds) {
    const promise = pfp(feed);
    const catch_promise = promise.catch(console.warn);
    promises.push(promise);
  }

  const results = await Promise.all(promises);
  const count = results.reduce(acc_if_def, 0);
  show_poll_notification(count);
  console.debug('Added %d entries', count);
}

function acc_if_def(sum, value) {
  return isNaN(value) ? sum : sum + value;
}

function show_poll_notification(num_entries_added) {
  if (num_entries_added < 1) {
    return;
  }

  const title = 'Added articles';
  const message = 'Added articles';
  app.show_notification(title, message);
}

function noop() {}
