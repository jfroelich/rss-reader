export function unsubscribe(session, feed_id) {
  return session.deleteFeed(feed_id, 'unsubscribe');
}
