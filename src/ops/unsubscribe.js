import delete_resource from '/src/db/ops/delete-resource.js';

export default function unsubscribe(conn, feed_id) {
  return delete_resource(conn, feed_id, 'unsubscribe');
}
