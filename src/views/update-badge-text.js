import {rdb_entry_count_unread} from '/src/rdb.js';

// TODO: primary todo, trying to remove auto-connect from rdb.js, this is the
// sole caller of rdb_entry_count_unread. In order to remove auto-connect I
// need ensure all callers of this function use a valid connection. In doing so,
// do not forget that this can _still_ be called non-awaited with a connection.



// TODO: perhaps think of badge as a view, like the other pages or the CLI. In
// that sense it would be reasonable to open a channel and listen for change
// events. I am going to wait on making this change until rdb.js redesign is
// more complete.

// TODO: even if I don't do the observer thing, thinking of badge as a page,
// like a view, like the other pages, is probably a good idea. I don't feel like
// it belongs in feed-ops anyway so that would be a big win.

// TODO: thinking about channels. The problem is that the channel must be
// persistent. Of course it would be wonderful to just use a persistent channel,
// for example, in the background page. But that will not work, because the
// background page is not persistent. A persistent channel there would either
// cause the background page to become unloadable and effectively persistent, or
// it would just not receive messages except when active. I cannot use the
// slideshow's listener. It is only available when the slideshow page is
// displayed, which is not always. So ... I need some kind of general listener
// that is used by every component in the app that modifies entry state related
// to read state, entry creation, or entry deletion. Or, I keep the current
// approach. Ok, what I could do is cheat somehow and use
// extension.getBackgroundPage()? That would load the page if not loaded

// A lock to discard concurrent calls
let badge_update_pending = false;

// Updates the text of the application's badge. Non-blocking.
export default async function badge_update_text(conn) {
  if (badge_update_pending) {
    console.debug('badge_update_text request already pending, ignoring call');
    return;
  }

  console.debug('Updating badge text...');

  badge_update_pending = true;

  // We trap the error for two reasons:
  // 1) the conn may have been closed when non-awaited
  // 2) this is essentially a view, and views suppress errors or display them to
  // the user, but this is a hidden view, so all this can do is log the error.

  let count;
  try {
    count = await rdb_entry_count_unread(conn);
  } catch (error) {
    console.error(error);
    return;
  } finally {
    badge_update_pending = false;
  }

  const text = count > 999 ? '1k+' : '' + count;
  console.debug('Setting badge text to', text);
  chrome.browserAction.setBadgeText({text: text});
}
