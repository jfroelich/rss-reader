import updateBadgeText from "/src/views/update-badge-text.js";
import {markEntryRead as storeMarkEntryRead} from "/src/rdb.js";

// TODO: this shouldn't be dependent on something in views, it should be the other way around

// TODO: if I refactor badge to listen for events then I could call the database function
// directly. Right now this intermediate operation exists primarily because badge stuff
// does not belong in feed store
// TODO: review http://www.micheltriana.com/blog/2012/04/09/library-oriented-architecture

export default async function markEntryRead(conn, channel, entryId) {

  // TODO: I would prefer this to not be awaited, but I need to defer the badge update call
  // until after it resolves.

  await storeMarkEntryRead(conn, channel, entryId);
  console.debug('Marked entry %d as read', entryId);
  updateBadgeText();// non-blocking
}
