import {localstorage_read_int} from '/src/lib/localstorage-read-int.js';
import {count_unread_entries, open_reader_db} from '/src/reader-db.js';

let debounce_timer_id = undefined;

// Refreshes the unread articles count displayed in the extension's browser
// action in the Chrome chrome. Operations that affect the unread count,
// actually or potentially, should follow up with a call to this function so as
// to update the view state to match the model state.
//
// The update is not immediate but is instead scheduled to occur shortly after
// refresh is called. If there is a concurrent request that occurs during the
// initial request delay, then it cancels the prior request. The latter request
// wins. The latter request generally implies that data changed after the prior
// request, so the latter request will be more accurate.
export function refresh_badge() {
  if (typeof debounce_timer_id !== 'undefined') {
    console.debug('Clearning timer', debounce_timer_id);
    clearTimeout(debounce_timer_id);
    debounce_timer_id = undefined;
  } else {
    // TEMP
    console.debug('Not clearing timer');
  }

  let delay = localstorage_read_int(localStorage.refresh_badge_delay);
  debounce_timer_id = setTimeout(do_scheduled_refresh, delay);
}

async function do_scheduled_refresh() {
  // The try/catch is to log the error. This is an async so exceptions will
  // be promise-swallowed, but it is funky to catch when this function itself
  // is a parameter to setTimeout, so use local catch here to print out error

  let conn;
  try {
    conn = await open_reader_db();
    const count = await count_unread_entries(conn);
    const text = count > 999 ? '1k+' : '' + count;
    console.debug('Setting badge text to', text);
    chrome.browserAction.setBadgeText({text: text});
  } catch (error) {
    console.error(error);
  } finally {
    // Just help with the logging in the scheduler
    debounce_timer_id = undefined;

    if (conn) {
      conn.close();
    }
  }
}

export function register_badge_click_listener(listener) {
  chrome.browserAction.onClicked.addListener(listener);
}
