import * as badge from '/src/badge.js';
import {delete_feed} from '/src/operations/delete-feed.js';

export async function unsubscribe(conn, channel, feed_id) {
  const reason_text = 'unsubscribe';
  await delete_feed(conn, channel, feed_id, reason_text);

  // Removing entries may impact the unread count, so update the badge
  // non-awaited
  badge.update(conn).catch(console.error);
}
