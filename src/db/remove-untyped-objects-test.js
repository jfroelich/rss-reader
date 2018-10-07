import assert from '/src/assert/assert.js';
import {open} from './open.js';
import {remove_untyped_objects} from './remove-untyped-objects.js';
import {remove} from './remove.js';

export async function remove_untyped_objects_test() {
  const db_name = 'remove-untyped-objects-test';
  await remove(db_name);
  const session = await open(db_name);

  // Create some entries
  const create_promises = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const entry = {};
    entry.title = 'title' + i;
    const promise = create_untyped_entry(session, entry);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);

  // Count how many entries there are before running the op.
  const pre_op_count = await count_entries(session);
  assert(pre_op_count !== 0);

  // Create a channel stub that records messages for later assertions
  const messages = [];
  const channel = {};
  channel.name = 'remove-untyped-objects-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  // Attach the channel, run the op, then detach
  session.channel = channel;
  await remove_untyped_objects(session);
  session.channel = undefined;

  // Count how many there are after the op. We only created entries that should
  // be removed, so everything should be removed.
  const post_op_count = await count_entries(session);
  assert(post_op_count === 0);

  // Removing entries should have resulted in at least one message.
  assert(messages.length > 0);

  session.close();
  await remove(db_name);
}

// at the moment there is only count-unread-entries in the api, so to get an
// actual count of all entries we have to create a specialized helper for this
// test.
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

// create_entry validates entry.type, and provides no option to disable that
// validation, so as a workaround we recreate a simple version of the function
// that does no validation at all and that is local to this test
function create_untyped_entry(session, entry) {
  return new Promise((resolve, reject) => {
    let id = 0;
    const tx = session.conn.transaction('entry', 'readwrite');
    tx.oncomplete = _ => resolve(id);
    tx.onerror = event => reject(event.target.error);

    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = _ => id = request.result;
  });
}
