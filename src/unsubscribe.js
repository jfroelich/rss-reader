import * as db from '/src/db/db.js';

export default function unsubscribe(conn, feedId) {
  return db.deleteResource(conn, feedId, 'unsubscribe');
}
