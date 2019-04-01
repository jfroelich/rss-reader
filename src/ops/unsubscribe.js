import delete_feed from '/src/db/ops/delete-feed.js';

export default function unsubscribe(conn, feed_id) {
  return delete_feed(conn, feed_id, 'unsubscribe');
}
