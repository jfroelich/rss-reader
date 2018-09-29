import {iterate_entries} from '/src/db/op/iterate-entries.js';

export async function remove_lost_entries(conn, channel) {
  const ids = await remove_lost_entries_internal(conn);

  if (channel) {
    for (const id of ids) {
      channel.postMessage({type: 'entry-deleted', id: id, reason: 'lost'});
    }
  }

  return ids;
}

// TODO: inline
async function remove_lost_entries_internal(conn) {
  const deleted_ids = [];
  await iterate_entries(conn, cursor => {
    const entry = cursor.value;
    if (!entry.urls || !entry.urls.length) {
      cursor.delete();
      deleted_ids.push(entry.id);
    }
  });
  return deleted_ids;
}
