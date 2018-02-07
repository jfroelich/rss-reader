import {rdb_entry_mark_read} from '/src/rdb.js';
import badge_update_text from '/src/views/update-badge-text.js';

// TODO: this shouldn't be dependent on something in views, it should be the
// other way around

// TODO: if I refactor badge to listen for events then I could call the
// database function directly. Right now this intermediate operation exists
// primarily because badge stuff does not belong in feed store
// TODO: review
// http://www.micheltriana.com/blog/2012/04/09/library-oriented-architecture

export default async function entry_mark_read(conn, channel, entry_id) {
  // TODO: I would prefer this to not be awaited, but I need to defer the badge
  // update call until after it resolves. I suppose I could use a promise?

  // TODO: make sure conn is defined by this point because rdb_entry_mark_read
  // no longer auto-connects
  // TEMP: paranoid assertion
  assert(conn instanceof IDBDatabase);

  await rdb_entry_mark_read(conn, channel, entry_id);
  console.debug('Marked entry %d as read', entry_id);

  // Call unawaited. We can still pass conn because the update starts in the
  // current tick, which is prior to conn closing externally, because we know
  // conn is open or else call to rdb_entry_mark_read would have failed.
  // TODO: actually, we don't. We await above, so it is entirely possible the
  // connection is closed by now?
  // TODO: second issue, now that I think about it, might be transactional
  // consistency. Except that in this case consistency doesn't matter because a
  // count of objects in a store is unrelated to any single CRUD operation
  // exclusively, it is related to any of them, the only thing that matters is
  // that the count happens after.

  // TEMP: I am planning on removing the auto-connect feature from the internals
  // of badge_update_text. Which means that conn must be defined and active
  // here. I am logging something here to quickly tell if for some reason the
  // conn is unavailable.
  assert(conn instanceof IDBDatabase);

  // This is not awaited because we don't care when this returns. We cannot do
  // anything about an error either so it is simply logged. We return prior to
  // this completing. By not blocking until this completes, we can quickly move
  // on to other work.
  badge_update_text(conn).catch(console.error);
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
