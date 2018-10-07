import assert from '/src/assert/assert.js';

import {create_entry} from './create-entry.js';
import * as entry_utils from './entry-utils.js';
import {get_entries} from './get-entries.js';
import {open} from './open.js';
import {remove_orphaned_entries} from './remove-orphaned-entries.js';
import {remove} from './remove.js';

export async function remove_orphaned_entries_test() {
  const db_name = 'remove-orphaned-entries-test';
  await remove(db_name);
  const session = await open(db_name);

  // TODO: create some entries not linked to any feeds, and then run remove
  // orphans, and then assert entries removed

  const n = 10;

  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = entry_utils.create_entry_object();
    entry.title = 'title' + i;
    const promise = create_entry(session, entry);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);

  const messages = [];
  const channel = {};
  channel.name = 'remove-orphaned-entries-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  const pre_op_count = await count_entries(session);
  assert(pre_op_count !== 0);

  session.channel = channel;
  await remove_orphaned_entries(session);
  session.channel = undefined;

  // All entries should have been removed because none are linked to a feed
  const post_op_count = await count_entries(session);
  assert(post_op_count === 0);

  assert(messages.length > 0);

  session.close();
  await remove(db_name);
}

function count_entries(session) {
  return new Promise((resolve, reject) => {
    const tx = session.conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.count();
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}

function noop() {}
