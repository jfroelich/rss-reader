import assert from '/src/base/assert.js';

import {create_entry} from './create-entry.js';
import * as entry_utils from './entry-utils.js';
import {get_entry} from './get-entry.js';
import {open} from './open.js';
import {remove} from './remove.js';
import {update_entry} from './update-entry.js';

export async function update_entry_test() {
  const db_name = 'update-entry-test';
  await remove(db_name);
  const session = await open(db_name);


  let entry = entry_utils.create_entry_object();
  entry.title = 'first-title';
  const entry_id = await create_entry(session, entry);

  const messages = [];
  const channel = {};
  channel.name = 'update-entry-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  session.channel = channel;

  entry = await get_entry(session, 'id', entry_id, false);
  entry.title = 'second-title';
  await update_entry(session, entry);

  session.channel = undefined;

  entry = await get_entry(session, 'id', entry_id, false);
  assert(entry.title === 'second-title');

  assert(messages.length === 1);
  const first_message = messages[0];
  assert(first_message.type === 'entry-updated');
  assert(first_message.id === entry_id);

  session.close();
  await remove(db_name);
}

function noop() {}
