export default function deactivate_feed(conn, feed_id, reason) {
  const props = {
    id: feed_id,
    active: false,
    deactivateDate: new Date(),
    deactivationReasonText: reason
  };

  const overwrite_flag = false;
  return conn.updateFeed(props, overwrite_flag);
}
