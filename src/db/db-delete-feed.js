import {refresh_badge} from '/src/badge.js';
import {is_valid_feed_id} from '/src/feed.js';
import {warn} from '/src/log.js';

// TODO: should consider de-optimizing by removing the feed index from the
// entry store. Deletes are rare events. There is not a great need for this
// operation to be fast. Maintaining the feed index on the entry store is
// expensive. What else relies on the feed index? If nothing else uses the feed
// index I could just remove it. Of course this is complex because it also
// requires a schema change, so I have to further complicate db-open.

// TODO: conn should not be an explicit parameter to txn_oncomplete, get it from
// the event

// TODO: entry_store should not be an explicit parameter to request_onsuccess,
// recreate it from transaction, get transaction from event

// TODO: because this affects unread count, this has to refresh bage. However,
// this causes a kind of circular dependency between layers. Unfortunately I
// made the design choice of integrating channel calls into db layer, but have
// no way to listen to channel messages elsewhere because nothing else is
// guaranteed at this point to point to a loaded-page that is listening, the
// only thing we know is that some view is loaded, whichever view is calling
// this, but we do not know which view. refresh-badge exists in the view layer
// but does not have its own view, it is a sub-view of sorts. Maybe add an
// entry-deleted event listener to every view that refreshes and remove this?
// Overhaul the vision for refresh-badge? I want this to be responsible for
// maintaining this view-to-db sync correspondence at the same time as not
// wanting it to be a concern of this module. Having a design where the lifetime
// of forked functions outlives the calling function lifetime leads to some
// complexity, I think this complexity smells bad, and really want to think of a
// better way to do this. I want operations to complete (as in, really settle
// where resource usage becomes 0), when they say they complete (when they
// exit). This is basically misleading by having delete-feed claim it is
// finished when it is actually not. It is like a coincidental side-effect. Also
// hard to test. At the same time I do not want to needlessly prolongue the
// lifetime of this function. Maybe I should? Maybe this should be awaited?



// Asynchronously removes a feed, and any entries associated with the feed, from
// the database. The operation resolves once the sole internal database
// transaction commits. A message is sent to the channel when the feed is
// deleted, and for each associated entry that is deleted.
//
// Calling this on a well-formed feed id that does not point to an existing feed
// in the database is a noop.
//
// @param conn {IDBDatabase} an open database connection
// @param channel {BroadcastChannel} receives messages when the feed is
// deleted and for each entry deleted
// @param feed_id {Number} the id of the feed to delete
// @param reason {String} optional, a categorical description of the reason
// for deletion, not sanity checked
// @throws {TypeError} invalid parameters
// @throws {DOMException} database errors
// @throws {InvalidStateError} if channel is closed when posting message, but
// note that db still modified
// @return {Promise} resolves to undefined
export function db_delete_feed(conn, channel, feed_id, reason) {
  return new Promise(executor.bind(null, conn, channel, feed_id, reason));
}

function executor(conn, channel, feed_id, reason, resolve, reject) {
  // Avoid misleading behavior
  if (!is_valid_feed_id(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  const entry_ids = [];
  const txn = conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(
      txn, conn, channel, feed_id, reason, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const feed_store = txn.objectStore('feed');
  feed_store.delete(feed_id);

  // We do not need to load full entries, just keys
  const entry_store = txn.objectStore('entry');
  const feed_index = entry_store.index('feed');
  const request = feed_index.getAllKeys(feed_id);
  request.onsuccess = request_onsuccess.bind(request, entry_ids, entry_store);
}

function request_onsuccess(entry_ids, entry_store, event) {
  const keys = event.target.result;
  for (const id of keys) {
    entry_ids.push(id);
    entry_store.delete(id);
  }
}

function txn_oncomplete(
    conn, channel, feed_id, reason, entry_ids, callback, event) {
  const feed_msg = {};
  feed_msg.type = 'feed-deleted';
  feed_msg.id = feed_id;
  feed_msg.reason = reason;
  channel.postMessage(feed_msg);

  const entry_msg = {};
  entry_msg.type = 'entry-deleted';
  entry_msg.id = 0;
  entry_msg.reason = reason;
  entry_msg.feed_id = feed_id;  // retain correspondence
  for (const id of entry_ids) {
    entry_msg.id = id;
    channel.postMessage(entry_msg);
  }

  refresh_badge(conn).catch(warn);

  callback();
}
