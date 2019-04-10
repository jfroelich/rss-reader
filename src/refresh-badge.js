import {Deadline} from '/lib/deadline.js';
import * as db from '/src/db/db.js';

// Refreshes the unread count displayed on the badge in Chrome's toolbar
export default async function refresh_badge() {
  // In the case of refreshing the badge, we want to use a larger timeout than
  // the default timeout used by open, which at the time of writing this comment
  // is 5 seconds. This is because we do not care as much how much time this
  // operation consumes.
  // TODO: just specify as indefinite?
  const timeout = new Deadline(15000);

  const conn = await db.open(timeout);
  const query = {conn: conn, type: 'entry', read: 0};
  const count = await db.count_resources(query);
  conn.close();

  const text = count > 999 ? '1k+' : '' + count;
  chrome.browserAction.setBadgeText({text: text});
}
