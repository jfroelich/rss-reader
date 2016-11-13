// See license.md

async function test() {
  console.log('Starting test');

  const db = new FeedDb();
  db.log = console;
  db.name = 'test-feed-db';
  db.version = 1;

  try {
    await db.connect();
  } catch(error) {
    console.warn(error);
  } finally {
    db.close();
  }

  console.log('Deleting database', db.name);
  await FeedDb.removeDatabase(db.name);
  console.log('Deleted database', db.name);
  console.log('Test completed');
}
