import update_feed from '/src/db/ops/update-feed.js';

export default function deactivate_feed(conn, feed_id, reason) {
  const props = {
    id: feed_id,
    active: false,
    deactivation_date: new Date(),
    deactivation_reason: reason
  };

  const overwrite_flag = false;
  return update_feed(conn, props, overwrite_flag);
}
