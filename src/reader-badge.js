'use strict';

// import base/assert.js
// import base/errors.js
// import extension.js
// import reader-db.js

// @throws AssertionError
async function readerUpdateBadge(conn) {
  assert(indexedDBIsOpen(conn));
  let count;
  try {
    count = await readerDbCountUnreadEntries(conn);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  console.debug('unread count is', count);
  extensionSetBadgeText(count);
  return RDR_OK;
}
