// See license.md

'use strict';

// TODO: it would be nice to use cursor.delete, but I need to learn how to
// use a cursor together with promises, it is funky
// TODO: test

function compact_favicons(db_target, log = SilentConsole) {
  return new Promise(async function(resolve, reject) {
    log.log('Compacting favicon cache');
    let num_deleted = 0;
    try {
      const conn = await favicon_db_connect(db_target, log);
      const entries = await favicon_db_get_entries(conn, log);

      for(let entry of entries) {
        if(favicon_entry_is_expired(entry, FAVICON_DEFAULT_MAX_AGE)) {
          let result = await favicon_db_remove_entry(conn, log,
            entry.pageURLString);
          num_deleted++;
        }
      }
      log.debug('Deleted %d favicon entries', num_deleted);
      resolve(num_deleted);
      conn.close();
    } catch(error) {
      reject(error);
    }
  });
}
