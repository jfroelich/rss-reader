// See license.md

'use strict';

async function update_badge(conn, log = SilentConsole) {
  log.log('Updating badge unread count');
  let internal_conn = conn;
  let text = 'ERR';
  try {
    if(!conn)
      internal_conn = await db_connect(undefined, log);
    const count = await db_count_unread_entries(log, internal_conn);
    if(!conn)
      internal_conn.close();
    text = count > 999 ? '1k+' : '' + count;
    log.debug('Setting badge text to', text);
    chrome.browserAction.setBadgeText({'text': text});
  } catch(error) {
    log.debug(error);
  }
  chrome.browserAction.setBadgeText({'text': text});
}
