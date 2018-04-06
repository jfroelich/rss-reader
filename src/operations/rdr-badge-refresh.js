import {console_stub} from '/src/lib/console-stub/console-stub.js';
import {count_unread_entries} from '/src/operations/count-unread-entries.js';

let update_pending = false;

export async function rdr_badge_refresh(conn, console = console_stub) {
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
