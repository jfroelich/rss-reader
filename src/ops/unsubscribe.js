import delete_feed from '/src/model/ops/delete-feed.js';

export function unsubscribe(model, feed_id) {
  return delete_feed(model, feed_id, 'unsubscribe');
}
