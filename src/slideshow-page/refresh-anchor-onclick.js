import {db_open} from '/src/db/db-open.js';
import {favicon_create_conn} from '/src/favicon.js';
import {poll_feeds} from '/src/poll/poll-feeds.js';

// TODO: this module should probably be merged into main-menu.js

let refresh_in_progress = false;

// TODO: this is a click handler, nothing happens after it since it is already
// forked, this could be async and not use ugly promise syntax
// TODO: show a completed message on refresh complete?
// TODO: show an error message on refresh error?
export async function refresh_anchor_onclick(event) {
  event.preventDefault();

  if (refresh_in_progress) {
    return;
  }

  refresh_in_progress = true;

  // Create a local channel object because apparently a channel cannot notify
  // itself (at least in Chrome 66) despite what spec states
  const onclick_channel = new BroadcastChannel(localStorage.channel_name);

  const rconn = await db_open();
  const iconn = await favicon_create_conn();

  const options = {};
  options.ignore_recency_check = true;
  await poll_feeds(rconn, iconn, onclick_channel, options);

  // Dispose of resources
  rconn.close();
  iconn.close();
  onclick_channel.close();

  refresh_in_progress = false;
}
