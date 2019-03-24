import count_unread_entries from '/src/db/ops/count-unread-entries.js';
import open from '/src/db/ops/open.js';

// Refreshes the unread count displayed the badge in Chrome's toolbar
export default async function refresh_badge() {
  const conn = await open();
  const count = await count_unread_entries(conn);
  conn.close();

  const text = count > 999 ? '1k+' : '' + count;
  chrome.browserAction.setBadgeText({text: text});
}
