import {db_count_unread_entries} from '/src/db/db-count-unread-entries.js';
import {console_stub} from '/src/lib/console-stub.js';

let update_pending = false;

export async function refresh_badge(conn, console = console_stub) {
  if (update_pending) {
    console.debug('%s: update pending', refresh_badge.name);
    return;
  }

  console.debug('%s: updating badge...', refresh_badge.name);
  update_pending = true;
  const count = await db_count_unread_entries(conn);
  console.debug('%s: counted %d unread entries', refresh_badge.name, count);
  const text = count > 999 ? '1k+' : '' + count;
  console.debug('%s: setting badge text to %s', refresh_badge.name, text);
  chrome.browserAction.setBadgeText({text: text});
  update_pending = false;
}

/*
# refresh-badge
write me

### Params

### Errors

### Return value

### Todos
* Perhaps think of badge as a view, like the other pages or the CLI. In that
sense it would be reasonable to open a channel and listen for change events.
* Even if I don't do the observer thing, thinking of badge as a page, like a
view, like the other pages, is probably a good idea. I don't feel like it
belongs in feed-ops anyway so that would be a big win.
* Thinking about channels. The problem is that the channel must be persistent.
Of course it would be wonderful to just use a persistent channel, for example,
in the background page. But that will not work, because the background page is
not persistent. A persistent channel there would either cause the background
page to become unloadable and effectively persistent, or it would just not
receive messages except when active. I cannot use the slideshow's listener. It
is only available when the slideshow page is displayed, which is not always. So
... I need some kind of general listener that is used by every component in the
app that modifies entry state related to read state, entry creation, or entry
deletion. Or, I keep the current approach. Ok, what I could do is cheat somehow
and use extension.getBackgroundPage()? That would load the page if not loaded
// TODO: look more into making refresh_badge easily unawaitable, because I
// only need to guarantee the request is set while the connection is not
// close-pending, so that even if the caller does close while it is pending,
// there is no issue, because close implicitly waits for pendings to settle.

*/
