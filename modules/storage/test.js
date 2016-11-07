// See license.md

async function test() {
  console.log('Starting test');
  const name = 'test-feed-db';
  const store = await ReaderStorage.connect(console, name, 1);
  store.disconnect();
  console.log('Deleting database', store.name);
  await ReaderStorage.removeDatabase(store.name);
  console.log('Deleted database', store.name);
  console.log('Test completed');
}
