import update_feed from '/src/db/ops/update-feed.js';

export default function deactivate_feed(conn, channel, feed_id, reason) {
  const props = {
    id: feed_id,
    active: false,
    deactivateDate: new Date(),
    deactivationReasonText: reason
  };

  const overwrite_flag = false;
  return update_feed(conn, channel, props, overwrite_flag);
}
