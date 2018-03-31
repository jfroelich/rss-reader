import {delete_feed} from '/src/operations/delete-feed.js';
import {rdr_badge_refresh} from '/src/operations/rdr-badge-refresh.js';

export async function unsubscribe(conn, channel, feed_id) {
  const reason_text = 'unsubscribe';
  await delete_feed(conn, channel, feed_id, reason_text);
  rdr_badge_refresh(conn).catch(console.error);
}
