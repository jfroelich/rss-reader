// See license.md

'use strict';

// Command line interface module. For performing operations from the console,
// with logging to console.
const cli = {};

cli.archive_entries = async function() {
  const store = await ReaderStorage.connect(console);
  const num_archived = await archive_entries(store, undefined, console);
  store.disconnect();
};

cli.poll = async function() {
  const num_added = await poll.run({
    'ignore_idle_state': 1,
    'skip_unmodified_guard': 1,
    'ignore_recent_poll_guard': 1,
    'log': console
  });
};
