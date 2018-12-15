import assert from '/src/assert.js';

import {create_entry} from './create-entry.js';
import * as entry_utils from './entry-utils.js';
import {get_entry} from './get-entry.js';
import {mark_entry_read} from './mark-entry-read.js';
import {open} from './open.js';
import {remove} from './remove.js';

export async function mark_entry_read_test() {
  const db_name = 'mark-entry-read-test';
  await remove(db_name);
  const session = await open(db_name);

  const entry = entry_utils.create_entry_object();
  entry.readState = entry_utils.ENTRY_STATE_UNREAD;
  const id = await create_entry(session, entry);

  let stored_entry = await get_entry(session, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === entry_utils.ENTRY_STATE_UNREAD);


  const messages = [];
  const channel = {};
  channel.name = 'mark-entry-read-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  session.channel = channel;
  await mark_entry_read(session, id);
  session.channel = undefined;

  stored_entry = undefined;
  stored_entry = await get_entry(session, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === entry_utils.ENTRY_STATE_READ);

  assert(messages.length === 1);
  const first_message = messages[0];
  assert(first_message.type === 'entry-read');
  assert(first_message.id === id);

  session.close();
  await remove(db_name);
}

function noop() {}
