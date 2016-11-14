// See license.md

'use strict';

// TODO: use a test db instead of the real db (and delete at end of test)

async function test_lookup(url_str) {
  const url = new URL(url_str);
  const fs = new FaviconService();
  fs.log = console;

  try {
    await fs.connect();
    console.debug(await fs.lookup(url));
  } catch(error) {
    console.warn(error);
  } finally {
    fs.close();
  }
}

async function test_compact() {
  const fc = new FaviconCache();

  try {
    await fc.connect();
    const numDeleted = await fc.compact();
    console.log('Deleted %d entries', numDeleted);
  } catch(error) {
    console.warn(error);
  } finally {
    fc.close();
  }
}
