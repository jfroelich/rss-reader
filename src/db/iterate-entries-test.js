import assert from '/src/base/assert.js';

import {create_entry} from './create-entry.js';
import * as entry_utils from './entry-utils.js';
import {iterate_entries} from './iterate-entries.js';
import {open} from './open.js';
import {remove} from './remove.js';

export async function iterate_entries_test() {
  const db_name = 'iterate-entries-test';
  await remove(db_name);
  const session = await open(db_name);

  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = entry_utils.create_entry_object();
    entry.title = 'test' + i;
    const promise = create_entry(session, entry);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);

  let num_iterated = 0;
  await iterate_entries(session, entry => {
    assert(entry);
    num_iterated++;
  });

  assert(num_iterated === n);

  session.close();
  await remove(db_name);
}
