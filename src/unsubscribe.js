import * as db from '/src/db/db.js';

export default function unsubscribe(conn, feed_id) {
  return db.deleteResource(conn, feed_id, 'unsubscribe');
}
