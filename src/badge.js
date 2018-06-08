import {count_unread_entries, open_reader_db} from '/src/reader-db.js';

// So, no more update_pending fake mutex thing. Instead, we debounce by having
// multiple things call this, and each one cancels any pending before scheduling
// a refresh. So if multiple calls, the later one always wins because it cancels
// the earlier one.

// BUG: it isn't debouncing. Everything is getting scheduled and nothing is
// getting canceled, because they all get scheduled too quickly. I am only
// setting the 'schedule without debounce' message in the console.

// BENCH NOTES: performance.now() showed approximately 1-3ms delay in the
// zero-delay configuration, seems fine in that case.

let debounce_timer_id = undefined;

export function refresh_badge() {
  if (typeof debounce_timer_id !== 'undefined') {
    console.debug('Clearning refresh-badge debounce timer', debounce_timer_id);
    clearTimeout(debounce_timer_id);
    debounce_timer_id = undefined;
  } else {
    // TEMP
    console.debug('Scheduling refresh-badge without clearing debounce timer');
  }

  // Using a longer delay than near-0 to increase cancelation frequency. The
  // delay is in milliseconds. Using asap delay (setting delay to 0 or
  // undefined) was leading to obverably nothing getting canceled and everything
  // getting scheduled too quickly and reaching its end of deferrment and
  // starting and therefore everything was running concurrently. So now this
  // imposes a fake delay on unread count updating that is probably higher than
  // the default near-0 delay. I don't think it will be noticeable but not sure.
  // It turns out that the cross-tab channel messages get sent faster than I
  // expected. Comp specs and load might be a factor I am not accounting for.
  let delay = 20;

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
