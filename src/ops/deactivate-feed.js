export function deactivate_feed(session, feed_id, reason) {
  const props = {
    id: feed_id,
    active: false,
    deactivateDate: new Date(),
    deactivationReasonText: reason
  };
  return session.updateFeed(props, false);
}
