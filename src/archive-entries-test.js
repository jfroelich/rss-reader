// See license.md

// TODO: insert test data, then run archive, make assertions about the
// state of the database, then delete the database
// TODO: i need to insert test entries, then run the archive,
// then test assertions

async function test() {
  const target = {
    'name': 'test-archive-entries',
    'version': 1
  };

  const max_age = 10;
  try {
    const num_modified = await archive_entries(target, max_age, console);
    await db_delete(target.name);
  } catch(error) {
    console.debug(error);
  }
}
