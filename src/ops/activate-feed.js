export function activate_feed(session, feed_id) {
  const props = {
    id: feed_id,
    active: true,
    deactivateDate: undefined,
    deactivationReasonText: undefined
  };
  return session.updateFeed(props, false);
}
