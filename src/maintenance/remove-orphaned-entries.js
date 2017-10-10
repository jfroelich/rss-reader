// TODO: reintroduce conn as a parameter
async function remove_orphaned_entries(options) {
  'use strict';
  options = options || {};
  let conn, ids, conn_timeout_ms;
  try {
    // TODO: are these even the correct property names?
    conn = await reader_db_open(options.dbName, options.dbVersion,
      conn_timeout_ms);
    const orphans = await reader_db_find_orphaned_entries(conn);
    ids = [];
    for(const entry of orphans)
      ids.push(entry.id);
    await reader_db_remove_entries(conn, ids);
  } finally {
    if(conn)
      conn.close();
  }

  // Make consistent with remove entries missing urls channeling. Maybe
  // remove entries missing urls needs to be changed to this
  if(ids && ids.length) {
    const channel = new BroadcastChannel('db');
    // TODO: if postMessage is structured cloning maybe it is better to
    // declare message once outside of loop, unless I can tell if it is
    // hoisted
    for(const id of ids) {
      const message = {'type': 'entryDeleted', 'id': id};
      channel.postMessage(message);
    }
    channel.close();
  }
}
