// See license.md

'use strict';

// TODO: insert test data, then run archive, make assertions about the
// state of the database, then delete the database
async function test() {
  const max_age = 10;
  let close_called = false;
  try {
    const store = ReaderStorage.connect('test-archive-entries', 1);
    store.log = console;
    const num_modified = await archive_entries(store, max_age, console);
    store.disconnect();
    close_called = true;
    await ReaderStorage.removeDatabase(target.name);
  } catch(error) {
    console.debug(error);
  } finally {
    if(!close_called && store)
      store.disconnect();
  }
}
