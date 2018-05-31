import {refresh_badge} from '/src/badge.js';
import {is_valid_feed_id} from '/src/feed.js';
import {log} from '/src/log.js';

// Asynchronously removes a feed, and any entries associated with the feed, from
// the database. The operation resolves once the sole internal database
// transaction commits. A message is sent to the channel when the feed is
// deleted, and for each associated entry that is deleted.
//
// This checks that the input feed id is valid in the sense that it is
// well-formed, but this never actually checks if the feed id corresponds to a
// feed object in the database, so be forewarned it is possible to call this and
// produce no effect. I anticipate that most of the time the caller should know
// that the feed id corresponds, so this correspondence is not validated because
// it would be pointless overhead to perform an extra lookup by id before
// deleting. Note this behavior is largely born out of the fact that this is
// only a shallow abstraction over an indexedDB call that exhibits this same
// issue of incomplete knowledge.
//
// @context-param conn {IDBDatabase} an open database connection
// @context-param channel {BroadcastChannel} receives messages when the feed is
// deleted and for each entry deleted
// @param feed_id {Number} the id of the feed to delete
// @param reason {String} optional, a categorical description of the reason
// for deletion, such as 'unsubscribe', or 'inactive', this parameter is not
// sanity checked
// @throws {TypeError} invalid feed id
// @rejects {DOMException} database errors
// @rejects {InvalidStateError} if channel is closed when posting message, but
// note that db still modified
// @return {Promise} resolves to undefined
// TODO: should consider de-optimizing by removing the feed index from the
// entry store. Deletes are rare events. There is not a great need for this
// operation to be fast. Maintaining the feed index on the entry store is
// expensive. What else relies on the feed index? If nothing else uses the feed
// index I could just remove it. Of course this is complex because it also
// requires a schema change, so I have to further complicate db-open.
export function db_delete_feed(feed_id, reason) {
  return new Promise(executor.bind(this, feed_id, reason));
}

function executor(feed_id, reason, resolve, reject) {
  // This check is justified because this resolves without error otherwise. It
  // would be a harmless no-op if deleting a bad id was allowed, but the app
  // policy is to discourage pointless no-ops particularly because they consume
  // resources and because it reduces confusion. This constitutes programmer
  // error.
  if (!is_valid_feed_id(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  let entry_ids = [];
  const txn_store_names = ['feed', 'entry'];
  const txn = this.conn.transaction(txn_store_names, 'readwrite');
  txn.oncomplete = delete_feed_txn_oncomplete.bind(
      this, feed_id, reason, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const feed_store = txn.objectStore('feed');

  log('%s: deleting feed %d', db_delete_feed.name, feed_id);
  feed_store.delete(feed_id);

  const entry_store = txn.objectStore('entry');
  const feed_index = entry_store.index('feed');

  // This uses getAllKeys rather than getAll when finding and iterating over
  // entries for a feed in order to avoid unnecessary deserialization of entries
  // TODO: use openKeyCursor for better scalability?
  const request = feed_index.getAllKeys(feed_id);

  // TODO: do not nest
  request.onsuccess = event => {
    const keys = request.result;

    for (const id of keys) {
      entry_ids.push(id);
      log('%s: deleting entry %d', db_delete_feed.name, id);
      entry_store.delete(id);
    }
  };
}

function delete_feed_txn_oncomplete(
    feed_id, reason, entry_ids, callback, event) {
  const feed_msg = {};
  feed_msg.type = 'feed-deleted';
  feed_msg.id = feed_id;
  feed_msg.reason = reason;
  this.channel.postMessage(feed_msg);

  const entry_msg = {};
  entry_msg.type = 'entry-deleted';
  entry_msg.id = 0;
  entry_msg.reason = reason;
  entry_msg.feed_id = feed_id;  // retain correspondence for listener
  for (const id of entry_ids) {
    entry_msg.id = id;
    this.channel.postMessage(entry_msg);
  }

  // A lot of commentary because this is complexity shoved under the rug

  // Deleting entries potentially modifies unread-count, so to maintain the
  // property of the badge unread count reflecting the state of the app, the
  // badge needs to be refreshed. In other words I want view state to be in sync
  // with database state. At the same time, I do not want to prolong the
  // life of the delete-feed call while it does this housekeeping work, so I
  // want to call refresh-badge unawaited. Because the call to refresh-badge is
  // unawaited it will still be pending when the delete-feed promise resolves.
  // The database connection can still be closed immediately on resolution of
  // the delete-feed promise because the refresh call at least starts in the
  // same tick as delete-feed, before the close-pending flag has been set as a
  // result of calling indexedDB's close method, and because indexedDB's close
  // method can be called while transactions are still pending.
  // TODO: avoid circular layer dependency, unfortunately i made the design
  // choice of integrating channel calls into db layer, but have no way to
  // listen to channel messages elsewhere because nothing else is guaranteed at
  // this point to point to a loaded-page that is listening, the only thing we
  // know is that some view is loaded, whichever view is calling this, but we do
  // not know which view. refresh-badge exists in the view layer but does not
  // have its own view, it is a sub-view of sorts. Maybe add an entry-deleted
  // event listener to every view that refreshes and remove this? Overhaul the
  // vision for refresh-badge? I want this to be responsible for maintaining
  // this view-to-db sync correspondence at the same time as not wanting it to
  // be a concern of this module.
  // TODO: having a design where the lifetime of forked functions outlives the
  // calling function lifetime leads to some complexity, I think this complexity
  // smells bad, and really want to think of a better way to do this. I want
  // operations to complete (as in, really settle where resource usage becomes
  // 0), when they say they complete (when they exit). This is basically
  // misleading by having delete-feed claim it is finished when it is actually
  // not. It is like a coincidental side-effect. Also hard to test. At the
  // same time I do not want to needlessly prolongue the lifetime of this
  // function. Maybe I should? Maybe this should be awaited?
  // NOTE: the catch is important, otherwise errors get swallowed, this is yet
  // another reason why forking is nasty business.
  refresh_badge(this.conn).catch(log);

  callback();
}
