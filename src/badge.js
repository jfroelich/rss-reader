import db_open from '/src/db/ops/db-open.js';
import count_unread_entries from '/src/db/ops/count-unread-entries.js';

// Refreshes the unread count displayed the badge in Chrome's toolbar
export async function badge_refresh() {
  const conn = await db_open();
  const count = await count_unread_entries(conn);
  conn.close();

  const text = count > 999 ? '1k+' : '' + count;
  set_badge_text({text: text});
}

export function set_badge_text(options) {
  return chrome.browserAction.setBadgeText(options);
}
