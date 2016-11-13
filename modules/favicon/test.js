// See license.md

'use strict';

// TODO: use a test db instead of the real db (and delete at end of test)

async function test_lookup(url_str, log) {
  const url = new URL(url_str);
  const fs = new FaviconService();
  fs.log = log;
  fs.cache.log = log;

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
  const fs = new FaviconService();
  try {
    await fs.connect();
    await fs.compact();
  } catch(error) {
    console.warn(error);
  } finally {
    fs.close();
  }
}
