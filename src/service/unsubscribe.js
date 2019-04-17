import * as rss from '/src/service/resource-storage-service.js';

export default function unsubscribe(conn, feedId) {
  return rss.deleteFeed(conn, feedId, 'unsubscribe');
}
