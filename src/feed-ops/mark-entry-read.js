import * as Status from "/src/common/status.js";
import updateBadgeText from "/src/feed-ops/update-badge-text.js";
import * as Entry from "/src/feed-store/entry.js";
import {markEntryRead as storeMarkEntryRead} from "/src/feed-store/feed-store.js";

// TODO: setup channel parameter and pass to storeMarkEntryRead
// TODO: if I refactor badge to listen for events then I could call the database function
// directly. Right now this intermediate operation exists primarily because badge stuff
// does not belong in feed store.
// TODO: revert to no-status pattern

// TODO: review http://www.micheltriana.com/blog/2012/04/09/library-oriented-architecture

export default async function markEntryRead(conn, channel, entryId) {

  // TODO: I would prefer this to not be awaited, but I need to defer the badge update call
  // until after it resolves. Put some more thought into it.

  await storeMarkEntryRead(conn, channel, entryId);
  console.debug('Marked entry %d as read', entryId);
  updateBadgeText();// non-blocking
}
