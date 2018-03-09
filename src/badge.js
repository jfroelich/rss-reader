import {rdb_entry_count_unread} from '/src/rdb/rdb.js';

let update_pending = false;

export async function update(conn) {
  if (update_pending) {
    console.debug('update request already pending, ignoring call');
    return;
  }

  console.debug('Updating badge text...');
  update_pending = true;

  let count;
  try {
    count = await rdb_entry_count_unread(conn);
  } catch (error) {
    console.error(error);
    return;
  } finally {
    update_pending = false;
  }

  const text = count > 999 ? '1k+' : '' + count;
  console.debug('Setting badge text to', text);
  chrome.browserAction.setBadgeText({text: text});
}
