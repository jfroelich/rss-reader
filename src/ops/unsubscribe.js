import delete_feed from '/src/db/ops/delete-feed.js';

export function unsubscribe(conn, channel, feed_id) {
  return delete_feed(conn, channel, feed_id, 'unsubscribe');
}
