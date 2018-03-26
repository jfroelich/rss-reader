import {count_unread_entries} from '/src/app/operations/count-unread-entries.js';

let update_pending = false;

export async function update(conn, console = null_console) {
  if (update_pending) {
    console.debug('Prior update pending, update request canceled');
    return;
  }

  console.debug('Updating badge text...');
  update_pending = true;

  // This could throw, but it really never should. If it does, it will leave
  // update_pending in incorrect state, but I'd rather not handle that error.
  const count = await count_unread_entries(conn);
  console.debug('Counted %d unread entries', count);

  const text = count > 999 ? '1k+' : '' + count;
  console.debug('Setting badge text to', text);

  chrome.browserAction.setBadgeText({text: text});

  update_pending = false;
}

function noop() {}

const null_console = {
  warn: noop,
  log: noop,
  debug: noop,
  error: noop
};
