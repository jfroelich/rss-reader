'use strict';

// import extension.js
// import rbl.js
// import reader-db.js

const READER_BADGE_DEBUG = false;

// @throws {AssertionError}
// @throws {Error} database related
async function readerBadgeUpdate(conn) {
  const count = await readerDbCountUnreadEntries(conn);
  const text = count > 999 ? '1k+' : '' + count;
  if(READER_BADGE_DEBUG) {
    console.debug('setting badge text to', text);
  }

  setBadgeText(text);
}
