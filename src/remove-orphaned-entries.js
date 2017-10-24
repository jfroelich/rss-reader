'use strict';

// import base/status.js
// import reader-db.js

async function remove_orphaned_entries(conn) {
  let ids;

  try {
    const orphans = await reader_db_find_orphaned_entries(conn);
    ids = [];
    for(const entry of orphans) {
      ids.push(entry.id);
    }

    await reader_db_remove_entries(conn, ids);
  } catch(error) {
    return ERR_DB;
  }

  if(ids && ids.length) {
    const channel = new BroadcastChannel('db');
    const message = {'type': 'entryDeleted', 'id': null};
    for(const id of ids) {
      message.id = id;
      channel.postMessage(message);
    }
    channel.close();
  }

  return STATUS_OK;
}
