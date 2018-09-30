import assert from '/src/assert/assert.js';
import * as errors from '/src/db/errors.js';
import * as feed_utils from '/src/db/feed-utils.js';
import * as types from '/src/db/types.js';

export async function activate_feed(session, feed_id) {
  assert(feed_utils.is_valid_feed_id(feed_id));
  await new Promise(executor.bind(null, session.conn, feed_id));
  if (session.channel) {
    const message = {type: 'feed-activated', id: feed_id};
    session.channel.postMessage(message);
  }
}

function executor(conn, feed_id, resolve, reject) {
  const txn = conn.transaction('feed', 'readwrite');
  // There is no txn.error, there is the request error that bubbled up
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = resolve;

  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess = get_request_onsuccess.bind(request, feed_id, reject);
}

function get_request_onsuccess(id, reject, event) {
  const feed = event.target.result;
  if (!feed) {
    const message = 'Could not find feed with id ' + id;
    const error = new errors.NotFoundError(message);
    reject(error);
    return;
  }

  if (!types.is_feed(feed)) {
    const message = 'Loaded object is not a feed for id ' + id;
    const error = new errors.InvalidStateError(message);
    reject(error);
    return;
  }

  if (feed.active) {
    const message = 'Cannot activate already active feed for id ' + id;
    const error = new errors.InvalidStateError(message);
    reject(error);
    return;
  }

  feed.active = true;
  delete feed.deactivateDate;
  delete feed.deactivationReasonText;
  feed.dateUpdated = new Date();

  const store = event.target.source;
  store.put(feed);
}
