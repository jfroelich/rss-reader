'use strict';

// import extension.js
// import rbl.js
// import reader-db.js

// @throws {AssertionError}
// @throws {Error} database related
async function readerBadgeUpdate(conn) {
  const count = await readerDbCountUnreadEntries(conn);
  const text = count > 999 ? '1k+' : '' + count;
  console.debug('setting badge text to', text);
  extensionSetBadgeText(text);
}
