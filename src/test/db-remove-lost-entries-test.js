import assert from '/src/assert.js';
import {create_entry} from '/src/db/create-entry.js';
import * as entry_utils from '/src/db/entry-utils.js';
import {get_entries} from '/src/db/get-entries.js';
import {open} from '/src/db/open.js';
import {remove_lost_entries} from '/src/db/remove-lost-entries.js';
import {remove} from '/src/db/remove.js';

export async function remove_lost_entries_test() {
  const db_name = 'remove-lost-entries-test';
  await remove(db_name);
  const session = await open(db_name);

  const n = 10;
  let num_lost = 0;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = entry_utils.create_entry_object();
    entry.title = 'title' + i;

    if (i % 3 === 0) {
      num_lost++;
    } else {
      const url = new URL('a://b.c' + i);
      entry_utils.append_entry_url(entry, url);
    }

    const promise = create_entry(session, entry);
    create_promises.push(promise);
  }
  const created_ids = await Promise.all(create_promises);

  const messages = [];
  const channel = {};
  channel.name = 'remove-lost-entries-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  session.channel = channel;

  const removed_ids = await remove_lost_entries(session);

  assert(removed_ids.length === num_lost);

  assert(messages.length === num_lost);
  for (const message of messages) {
    assert(message.type === 'entry-deleted');
    assert(entry_utils.is_valid_entry_id(message.id));
  }

  const remaining_entries = await get_entries(session, 'all', 0, 0);
  assert(remaining_entries.length === (created_ids.length - num_lost));

  session.close();
  await remove(db_name);
}

function noop() {}
