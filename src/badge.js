import {db_count_unread_entries} from '/src/db/db-count-unread-entries.js';
import {db_open} from '/src/db/db-open.js';
import {log} from '/src/log.js';

// TODO: Perhaps think of badge as a view, like the other pages or the CLI. In
// that sense it would be reasonable to open a channel and listen for change
// events.
// TODO: Even if I don't do the observer thing, thinking of badge as a page,
// like a view, like the other pages, is probably a good idea. I don't feel like
// it belongs in feed-ops anyway so that would be a big win.
// TODO: Thinking about channels. The problem is that the channel must be
// persistent. Of course it would be wonderful to just use a persistent channel,
// for example, in the background page. But that will not work, because the
// background page is not persistent. A persistent channel there would either
// cause the background page to become unloadable and effectively persistent, or
// it would just not receive messages except when active. I cannot use the
// slideshow's listener. It is only available when the slideshow page is
// displayed, which is not always. So I need some kind of general listener that
// is used by every component in the app that modifies entry state related to
// read state, entry creation, or entry deletion. Or, I keep the current
// approach. Ok, what I could do is cheat somehow and use
// extension.getBackgroundPage()? That would load the page if not loaded
// TODO: look more into making refresh_badge easily unawaitable, because I
// only need to guarantee the request is set while the connection is not
// close-pending, so that even if the caller does close while it is pending,
// there is no issue, because close implicitly waits for pendings to settle.


let update_pending = false;

export async function refresh_badge(conn) {
  if (update_pending) {
    log('%s: update pending', refresh_badge.name);
    return;
  }

  log('%s: updating badge...', refresh_badge.name);
  update_pending = true;
  const count = await db_count_unread_entries(conn);
  log('%s: counted %d unread entries', refresh_badge.name, count);
  const text = count > 999 ? '1k+' : '' + count;
  log('%s: setting badge text to %s', refresh_badge.name, text);
  chrome.browserAction.setBadgeText({text: text});
  update_pending = false;
}

export async function init_badge() {
  const conn = await db_open();
  refresh_badge(conn).catch(console.error);

  // We can enqueue the close immediately before refresh has completed, which
  // is why above line not awaited. close implicitly waits for pending
  // transactions to settle instead of aborting them.

  // Not using promise.finally() because there is no point to graceful
  // recovery

  conn.close();
}

export function register_badge_click_listener(listener) {
  chrome.browserAction.onClicked.addListener(listener);
}
