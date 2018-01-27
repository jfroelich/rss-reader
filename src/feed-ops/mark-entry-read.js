import updateBadgeText from "/src/views/update-badge-text.js";
import {markEntryRead as storeMarkEntryRead} from "/src/rdb.js";

// TODO: this shouldn't be dependent on something in views, it should be the other way around

// TODO: if I refactor badge to listen for events then I could call the database function
// directly. Right now this intermediate operation exists primarily because badge stuff
// does not belong in feed store
// TODO: review http://www.micheltriana.com/blog/2012/04/09/library-oriented-architecture

export default async function markEntryRead(conn, channel, entryId) {

  // TODO: I would prefer this to not be awaited, but I need to defer the badge update call
  // until after it resolves. I suppose I could use a promise?

  await storeMarkEntryRead(conn, channel, entryId);
  console.debug('Marked entry %d as read', entryId);

  // Call unawaited. We can still pass conn because the update starts in the current tick,
  // which is prior to conn closing externally, because we know conn is open or else
  // call to storeMarkEntryRead would have failed.
  // TODO: actually, we don't. We await above, so it is entirely possible the connection
  // is closed by now?
  // TODO: second issue, now that I think about it, might be transactional consistency. Except
  // that in this case consistency doesn't matter because a count of objects in a store is
  // unrelated to any single CRUD operation exclusively, it is related to any of them, the
  // only thing that matters is that the count happens after.

  updateBadgeText(conn);// non-blocking
}
