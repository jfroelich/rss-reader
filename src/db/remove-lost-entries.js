import {iterate_entries} from './iterate-entries.js';

export async function remove_lost_entries(session) {
  const ids = [];
  const handle_entry_bound = handle_entry.bind(null, ids);
  await iterate_entries(session, handle_entry_bound);

  if (session.channel) {
    for (const id of ids) {
      const message = {type: 'entry-deleted', id: id, reason: 'lost'};
      session.channel.postMessage(message);
    }
  }

  return ids;
}

function handle_entry(ids, cursor) {
  const entry = cursor.value;
  if (!entry.urls || !entry.urls.length) {
    cursor.delete();
    ids.push(entry.id);
  }
}
