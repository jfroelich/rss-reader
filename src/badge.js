import {count_unread_entries} from '/src/app/operations/count-unread-entries.js';

let update_pending = false;

export async function update(conn, console = null_console) {
  if (update_pending) {
    console.debug('prior update pending, update request canceled');
    return;
  }

  console.debug('Updating badge text...');
  update_pending = true;

  let count;
  try {
    count = await count_unread_entries(conn);
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

function noop() {}

const null_console = {
  warn: noop,
  log: noop,
  debug: noop,
  error: noop
};
