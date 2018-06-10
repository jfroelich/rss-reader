import * as db from '/src/db.js';

// Refreshes the unread articles count displayed in the extension's browser
// action in the Chrome chrome. Operations that affect the unread count,
// actually or potentially, should follow up with a call to this function so as
// to update the view state to match the model state.
//
// @param locker_name {String} a debugging hint referring to the context in
// which the function is called, optional, usually a value like "background
// page" or something will do, it should be a short value, its characters do not
// matter to the function's logic, each unique caller should use a unique name
// to prevent confusion (this is not guarded against) if monitoring the console.
// Ideally this would use someting like refresh_badge.caller.name or __caller__
// instead of an explict parameter but apparently it has all been deprecated so
// it isn't possible to encapsulate and hide this implementation detail.
// See https://stackoverflow.com/questions/280389
export async function refresh_badge(locker_name = 'unknown') {
  // Use a very hacky cross-page locking mechanism to prevent concurrent
  // requests in order to reduce database hits, particularly redundant ones.
  // This isn't actually atomic stuff so it isn't actually safe. We need to use
  // a shared state area like localStorage and cannot use a module-local
  // variable. This is because modules are loaded independently in each page,
  // and would only prevent concurrent requests per page, not all requests. All
  // this hacky work I believe is justified because even with all this, it is
  // less work done than in the case of concurrent refresh badge calls. Also
  // note that due to this setup, first one to acquire the lock wins the race,
  // and that is actually not desired (last one would be better because that
  // typically means state changed again) but because promises are not abortable
  // there is not a good alternative. Because this is first one wins it is
  // possible to get a bad unread count. However, I expect it is rare. The
  // contention mostly comes from cross-page concurrent requests, not same-page
  // concurrent requests. It is only bad for same-page calls such as when some
  // operation quickly adds several new articles in succession.

  // Note that this cross-page locking mechanism would not be necessary if I
  // just did everything from one page, such as having only the background page
  // handle such messages. But I cannot do that, because Google wants background
  // pages to be 'event' pages that stay in the unloaded state most of the time.
  // The background page is not reliably available. So I have to listen
  // everywhere for broadcasted state changes. That or I have to move the
  // concern of updating the badge into the database calls themselves, but this
  // would be worse, this means the database is strongly coupled with the view.
  const existing_lock = localStorage.refresh_badge_cross_page_lock;
  if (existing_lock) {
    return;
  }

  localStorage.refresh_badge_cross_page_lock = locker_name;

  // Ultra paranoia. Leaving in locked state is really bad. Pretend this is like
  // an C++ RAII autocall. The delay needs to be long enough to almost always
  // occur after the text updated.
  let did_auto_unlock = false;
  const auto_unlock_timer = setTimeout(_ => {
    console.warn('Releasing lock abnormally, locker was %s', locker_name);
    did_auto_unlock = true;
    delete localStorage.refresh_badge_cross_page_lock;
  }, 5000);

  const conn = await db.open_db();
  const count = await db.count_unread_entries(conn);
  conn.close();

  const text = count > 999 ? '1k+' : '' + count;
  chrome.browserAction.setBadgeText({text: text});

  // Exit before clearTimeout because its pointless now that the timer expired.
  // Exit before unlock because the other path did the unlock.
  if (did_auto_unlock) {
    return;
  }

  // Cancel the auto-unlock given that we are on the normal path
  clearTimeout(auto_unlock_timer);
  delete localStorage.refresh_badge_cross_page_lock;
}

export function register_badge_click_listener(listener) {
  chrome.browserAction.onClicked.addListener(listener);
}
