import * as Status from "/src/common/status.js";
import updateBadgeText from "/src/feed-ops/update-badge-text.js";
import * as Entry from "/src/feed-store/entry.js";
import FeedStore from "/src/feed-store/feed-store.js";

// TODO: review http://www.micheltriana.com/blog/2012/04/09/library-oriented-architecture

export default async function markEntryRead(store, entryId) {
  if(!(store instanceof FeedStore)) {
    console.error('Invalid store argument:', store);
    return Status.EINVAL;
  }

  if(!store.isOpen()) {
    console.error('store is not open');
    return Status.EINVALIDSTATE;
  }

  if(!Entry.isValidId(entryId)) {
    console.error('Invalid entryId argument:', entryId);
    return Status.EINVAL;
  }

  const status = await store.markEntryRead(entryId);
  if(status !== Status.OK) {
    console.error('Failed to mark entry as read:', Status.toString(status));
    return status;
  }

  console.debug('Marked entry with id %d as read', entryId);

  // Non-blocking
  updateBadgeText().catch(console.error);

  return Status.OK;
}
