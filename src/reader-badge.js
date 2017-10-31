'use strict';

// import base/errors.js
// import extension.js
// import reader-db.js

async function reader_update_badge(conn) {
  let count;
  try {
    count = await reader_db_count_unread_entries(conn);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  console.debug('unread count:', count);
  extension_set_badge_text(count);
  return RDR_OK;
}
