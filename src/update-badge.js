// See license.md

'use strict';

function update_badge(conn, log = SilentConsole) {
  return new Promise(update_badge_impl.bind(undefined, conn, log));
}

async function update_badge_impl(conn, log, resolve, reject) {
  log.log('Updating badge unread count');
  let internal_conn = conn;
  let text = 'ERR';
  let db_target;
  try {
    if(!conn)
      internal_conn = await db_connect(db_target, log);
    const count = await db_count_unread_entries(log, internal_conn);
    if(!conn)
      internal_conn.close();
    text = count > 999 ? '1k+' : '' + count;
    log.debug('Setting badge text to', text);
    chrome.browserAction.setBadgeText({'text': text});
    resolve();
  } catch(error) {
    chrome.browserAction.setBadgeText({'text': text});
    log.debug(error);
    reject(error);
  }
}
