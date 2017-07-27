// See license.md

'use strict';

async function testLookup(urlString, isCacheless) {
  const url = new URL(urlString);
  let conn;

  const options = {};
  options.verbose = true;

  try {
    if(!isCacheless) {
      conn = await favicon.connect(options);
    }

    const iconURLString = await favicon.lookup(conn, url, options);
    console.debug('Icon url:', iconURLString);
  } catch(error) {
    console.error(error);
  } finally {
    if(!isCacheless && conn) {
      conn.close();
    }
  }
}

async function testClear() {
  let conn;
  const options = {};
  options.verbose = true;

  try {
    conn = await favicon.connect(options);
    await favicon.clearCache(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

async function testCompact() {
  let conn;
  try {
    conn = await favicion.connect();
    const numDeleted = await favicon.compact(conn);
    console.log('Deleted %d entries', numDeleted);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}
