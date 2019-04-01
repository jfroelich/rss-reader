import Connection from '/src/db/connection.js';
import sanitize_feed from '/src/db/ops/sanitize-feed.js';
import validate_feed from '/src/db/ops/validate-feed.js';
import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

// Write the feed to the database, replacing any feed with the same key path.
export default function put_feed(conn, feed) {
  return new Promise(put_feed_executor.bind(this, conn, feed));
}

function put_feed_executor(conn, feed, resolve, reject) {
  assert(conn instanceof Connection);
  assert(feed && typeof feed === 'object');
  assert(resource_utils.is_valid_id(feed.id));
  assert(resource_utils.has_url(feed));

  // Prepare the feed for storage
  resource_utils.normalize(feed);
  sanitize_feed(feed);
  validate_feed(feed);
  filter_empty_properties(feed);
  feed.updated_date = new Date();

  const transaction = conn.conn.transaction('feeds', 'readwrite');
  transaction.onerror = event => reject(event.target.error);
  transaction.oncomplete =
      transaction_oncomplete.bind(transaction, feed, conn.channel, resolve);
  transaction.objectStore('feeds').put(feed);
}

function transaction_oncomplete(feed, channel, callback, event) {
  if (channel) {
    channel.postMessage({type: 'feed-updated', id: feed.id});
  }

  callback();
}
