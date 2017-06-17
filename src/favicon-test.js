// See license.md

'use strict';

// TODO: use a test db instead of the real db (and delete at end of test)
// TODO: update to reflect new function api

async function testFaviconLookup(urlString) {
  const url = new URL(urlString);
  const fs = new FaviconService();
  fs.log = console;

  try {
    await fs.jrDbConnect();
    console.debug(await fs.lookup(url));
  } catch(error) {
    console.warn(error);
  } finally {
    fs.close();
  }
}

async function testCompactFavicons() {
  const fc = new FaviconCache();

  try {
    await fc.jrDbConnect();
    const numDeleted = await fc.compact();
    console.log('Deleted %d entries', numDeleted);
  } catch(error) {
    console.warn(error);
  } finally {
    fc.close();
  }
}
