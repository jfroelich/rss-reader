import * as favicon from '/lib/favicon.js';
import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import { Deadline, INDEFINITE } from '/lib/deadline.js';
import { NetworkError } from '/lib/better-fetch.js';
import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';

// This is a very specific test that ensures favicon lookup functionality
// matches browser functionality for the domain oracle.com. oracle.com for
// some reason returns the content type "unknown" which was previously an
// cause of failure for lookups.
async function faviconOracleTest() {
  const databaseName = faviconOracleTest.name;
  await indexedDBUtils.remove(databaseName);
  const conn = await favicon.open(databaseName);

  const url = new URL('https://www.oracle.com');
  const request = new favicon.LookupRequest();
  request.conn = conn;
  request.url = url;

  const resultURL = await favicon.lookup(request);
  const resultURLString = resultURL ? resultURL.href : undefined;
  const expected = 'https://www.oracle.com/favicon.ico';
  assert(resultURLString === expected);
  conn.close();
  await indexedDBUtils.remove(databaseName);
}

async function faviconCacheOpenTest() {
  const databaseName = faviconCacheOpenTest.name;
  await indexedDBUtils.remove(databaseName);
  const conn = await favicon.open(databaseName);
  assert(typeof conn === 'object');
  assert(typeof conn.close === 'function');
  conn.close();
  await indexedDBUtils.remove(conn.name);
}

async function faviconCachePutFindTest() {
  await indexedDBUtils.remove(faviconCachePutFindTest.name);
  const conn = await favicon.open(faviconCachePutFindTest.name);
  const entry = new favicon.Entry();
  entry.hostname = 'www.example.com';
  await favicon.putEntry(conn, entry);
  const foundEntry = await favicon.findEntry(conn, new URL(`http://${entry.hostname}`));
  assert(foundEntry);
  assert(foundEntry.hostname === entry.hostname);
  conn.close();
  await indexedDBUtils.remove(faviconCachePutFindTest.name);
}

async function faviconCacheClearTest() {
  await indexedDBUtils.remove(faviconCacheClearTest.name);
  const conn = await favicon.open(faviconCacheClearTest.name);

  const insertCount = 3;
  const createPromises = [];
  for (let i = 0; i < insertCount; i += 1) {
    const entry = new favicon.Entry();
    entry.hostname = `www.example${i}.com`;
    createPromises.push(favicon.putEntry(conn, entry));
  }
  await Promise.all(createPromises);

  const beforeClearCount = await countEntries(conn);
  assert(beforeClearCount === insertCount);
  await favicon.clear(conn);
  const afterClearCount = await countEntries(conn);
  assert(afterClearCount === 0);

  conn.close();
  await indexedDBUtils.remove(faviconCacheClearTest.name);
}

// Insert a mix of expired and non-expired entries. Then run compact and check
// the expired entries are gone and the non-expired entries remain.
async function faviconCacheCompactTest() {
  const databaseName = faviconCacheCompactTest.name;
  await indexedDBUtils.remove(databaseName);
  const conn = await favicon.open(databaseName);

  const sixMonthsInMillis = 1000 * 60 * 60 * 24 * 31 * 6;

  const createPromises = [];
  for (let i = 0; i < 10; i += 1) {
    const entry = new favicon.Entry();
    entry.hostname = `www.example${i}.com`;

    const now = new Date();
    if ((i % 2) === 0) {
      entry.expires = new Date(now.getTime() - sixMonthsInMillis);
    } else {
      entry.expires = new Date(now.getTime() + sixMonthsInMillis);
    }

    const promise = favicon.putEntry(conn, entry);
    createPromises.push(promise);
  }

  await Promise.all(createPromises);
  await favicon.compact(conn);

  const findPromises = [];
  for (let i = 0; i < 10; i += 1) {
    const url = new URL(`http://www.example${i}.com`);
    findPromises.push(favicon.findEntry(conn, url));
  }
  const results = await Promise.all(findPromises);
  for (let i = 0; i < 10; i += 1) {
    assert(i % 2 ? results[i] !== undefined : results[i] === undefined);
  }

  conn.close();
  await indexedDBUtils.remove(databaseName);
}

// This is not part of the built in api. It would exist only for test purposes.
// So I violate abstraction here to get it. I think that is ok in test context
// which is allowed to know of internals. Keep in mind this may fail
// unexpectedly whenever favicon.js is modified. I might move this into
// favicon but am undecided.
function countEntries(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entries');
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entries');
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
  });
}

async function fetchImageTest() {
  let path = '/test/favicon-fetch-image-test.png';
  let urlString = resolveExtensionPath(path);
  let url = new URL(urlString);

  // Test using explicit indefiniteness
  let options = { timeout: INDEFINITE };
  let response = await favicon.fetchImage(url, options);
  assert(response);

  // Test with an explicit definite timeout that should never happen
  // in test context
  options = { timeout: new Deadline(100000) };
  response = await favicon.fetchImage(url, options);
  assert(response);

  // Test against a non-existent image
  path = '/src/lib/i-do-not-exist.png';
  urlString = resolveExtensionPath(path);
  url = new URL(urlString);
  options = undefined; // reset for isolation, presumably indefinite default
  let error404;
  try {
    response = await favicon.fetchImage(url, options);
  } catch (error) {
    error404 = error;
  }

  // Fetching a non-existent LOCAL image should have produced the correct error
  // NOTE: what happens is that better-fetch traps the native type error that
  // is thrown by the native fetch call, and translates this into a network
  // error type, as an attempt to produce a clearer error type. The native
  // fetch call does not produce a response that is later a 404 and therefore
  // a fetch error as one might expect, at least for loading a local file.
  // The point of all this is to be aware of the difference in behavior for
  // loading a local url vs a remote url. In the remote case, we could connect
  // to the server (no more network error), and then the server would respond
  // with a 404 response, which causes better-fetch to produce a FetchError.
  // We are basically not testing remote behavior, which is actually the typical
  // use case that we should be testing. But in order to do that I need to think
  // of the proper netiquette.
  assert(error404 instanceof NetworkError);
}

function resolveExtensionPath(path) {
  return chrome.extension.getURL(path);
}

TestRegistry.registerTest(faviconOracleTest);
TestRegistry.registerTest(faviconCacheOpenTest);
TestRegistry.registerTest(faviconCachePutFindTest);
TestRegistry.registerTest(faviconCacheClearTest);
TestRegistry.registerTest(faviconCacheCompactTest);
TestRegistry.registerTest(fetchImageTest);
