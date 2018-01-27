import {countUnreadEntries, open} from "/src/rdb.js";

// TODO: think of how to reduce connection usage, maybe maintain a persistent connection? Then
// again now that this is non-blocking, maybe the slowness of it does not matter?

// TODO: this should be able to accept an input connection. I removed the conn parameter earlier
// when every call to updateBadgeText was awaited. I can still use a non-blocking call, because
// the request enters pending state in the current tick, before the conn is closed externally.
// So this should be changed to accept connection again and not connect locally.


// TODO: perhaps think of badge as a view, like the other pages or the CLI. In that sense
// it would be reasonable to open a channel and listen for change events. I am going to wait
// on making this change until rdb.js redesign is more complete.

// TODO: even if I don't do the observer thing, thinking of badge as a page, like a view, like
// the other pages, is probably a good idea. I don't feel like it belongs in feed-ops anyway
// so that would be a big win.

// TODO: thinking about channels. The problem is that the channel must be persistent.
// Of course it would be wonderful to just use a persistent channel, for example, in
// the background page. But that will not work, because the background page is not persistent.
// A persistent channel there would either cause the background page to become unloadable and
// effectively persistent, or it would just not receive messages except when active.
// I cannot use the slideshow's listener. It is only available when the slideshow page is
// displayed, which is not always. So ... I need some kind of general listener that is used
// by every component in the app that modifies entry state related to read state, entry creation,
// or entry deletion. Or, I keep the current approach.
// Ok, what I could do is cheat somehow and use extension.getBackgroundPage()? That would load
// the page if not loaded

// A lock to discard concurrent calls
let badgeUpdatePending = false;

// Updates the text of the application's badge. Non-blocking.
export default async function updateBadgeText(conn) {
  if(badgeUpdatePending) {
    console.debug('updateBadgeText request already pending, ignoring call');
    return;
  }

  console.debug('Updating badge text...');

  badgeUpdatePending = true;

  // We trap the error for two reasons:
  // 1) the conn may have been closed when non-awaited
  // 2) this is essentially a view, and views suppress errors or display
  // them to the user, but this is a hidden view, so all this can do is
  // log the error.

  let count;
  try {
    count = await countUnreadEntries(conn);
  } catch(error) {
    console.error(error);
    return;
  } finally {
    badgeUpdatePending = false;
  }

  const text = count > 999 ? '1k+' : '' + count;
  console.debug('Setting badge text to', text);
  chrome.browserAction.setBadgeText({text: text});
}
