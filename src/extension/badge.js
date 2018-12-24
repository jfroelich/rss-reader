import * as db from '/src/db/db.js';

export function install_listener(event) {
  // We do not care if event.reason is install or update. While it would seem
  // like we only need to do this on install, reloading the extension from
  // chrome's extensions page also triggers an update event where for some
  // reason the badge text is unset, so we must set it again.
  refresh();
}

export function startup_listener(event) {
  refresh();
}

// Refreshes the unread count displayed the badge in Chrome's toolbar
export async function refresh() {
  const session = await db.open();
  const count = await db.count_unread_entries(session);
  session.close();

  const text = count > 999 ? '1k+' : '' + count;
  chrome.browserAction.setBadgeText({text: text});
}
