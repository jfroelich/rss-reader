import * as Status from "/src/common/status.js";
import updateBadgeText from "/src/feed-ops/update-badge-text.js";
import * as Entry from "/src/feed-store/entry.js";
import {markEntryRead as storeMarkEntryRead} from "/src/feed-store/feed-store.js";

// TODO: review http://www.micheltriana.com/blog/2012/04/09/library-oriented-architecture
// TODO: setup channel parameter and pass to storeMarkEntryRead

// TODO: if I refactor badge to listen for events then I could call the database function
// directly. Right now this intermediate operation exists primarily because badge stuff
// does not belong in feed store.

export default async function markEntryRead(conn, entryId) {

  // TEMP: channel not yet setup
  let channel;

  const status = await storeMarkEntryRead(conn, channel, entryId);
  if(status !== Status.OK) {
    console.error('Failed to mark entry as read:', Status.toString(status));
    return status;
  }

  console.debug('Marked entry with id %d as read', entryId);
  updateBadgeText();// non-blocking
  return Status.OK;
}
