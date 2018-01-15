import * as Status from "/src/common/status.js";
import {countUnreadEntries, open} from "/src/feed-store/feed-store.js";

// TODO: think of how to reduce connection usage, maybe maintain a persistent connection? Then
// again now that this is non-blocking, maybe the slowness of it does not matter?

// TODO: perhaps think of badge as a view, like the other pages or the CLI. In that sense
// it would be reasonable to open a channel and listen for change events. I am going to wait
// on making this change until feed-store.js redesign is more complete.

// TODO: even if I don't do the observer thing, thinking of badge as a page, like a view, like
// the other pages, is probably a good idea. I don't feel like it belongs in feed-ops anyway
// so that would be a big win.

// A lock to discard concurrent calls
let pending = false;

// Updates the text of the application's badge. Non-blocking.
export default async function updateBadgeText() {
  if(pending) {
    console.debug('updateBadgeText request already pending, ignoring call');
    return Status.OK;
  }

  console.debug('Updating badge text...');

  pending = true;

  let [status, conn] = await open();
  if(status !== Status.OK) {
    console.error('Failed to open database:', Status.toString(status));
    pending = false;
    return status;
  }

  let count;
  [status, count] = await countUnreadEntries(conn);
  if(status !== Status.OK) {
    console.error('Failed to count unread entries:', Status.toString(status));
    pending = false;
    conn.close();
    return status;
  }
  conn.close();

  pending = false;

  const text = count > 999 ? '1k+' : '' + count;
  console.debug('Setting badge text to', text);
  chrome.browserAction.setBadgeText({text: text});
  return Status.OK;
}
