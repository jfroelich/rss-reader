import {count_unread_entries} from '/src/reader-db.js';

// TODO: somehow remove cyclical dep with reader-db

// One way. The db ops should not be calling refresh badge. Instead, channel
// messages listeners should be doing in response to messages for other reasons.
// One issue with that, is extremely weak coupling of a required followup
// action. A second issue is that we don't know which view will be loaded at
// any one point in time. Ops take place in multiple views, calls get sent out
// all over the place.

// Second way. Some kind of side channel. Basically a secondary callback for
// each database operation. Then every call can pass in an extra callback that
// does the badge refresh. The badge call is then only bound to the function
// callback definition defined in the caller, and not in the db. But this also
// has problems. One, it should not be caller's concern. Two, ton of
// boilerplate. Three, awkwardness of multi-channel.


let update_pending = false;

export async function refresh_badge(conn) {
  if (update_pending) {
    console.debug('Badge update still pending');
    return;
  }

  update_pending = true;
  const count = await count_unread_entries(conn);
  const text = count > 999 ? '1k+' : '' + count;
  console.debug('Setting badge text to', text);
  chrome.browserAction.setBadgeText({text: text});
  update_pending = false;
}

export function register_badge_click_listener(listener) {
  chrome.browserAction.onClicked.addListener(listener);
}
