import assert from '/src/lib/assert.js';
import * as favicon from '/src/lib/favicon/favicon.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

// This is a very specific test that ensures favicon lookup functionality
// matches browser functionality for the domain oracle.com. oracle.com for
// some reason returns the content type "unknown" which was previously an
// cause of failure for lookups.
export async function favicon_oracle_test() {
  const db_name = favicon_oracle_test.name;
  await indexeddb_utils.remove(db_name);
  const conn = await favicon.open(db_name);

  const url = new URL('https://www.oracle.com');
  const request = new favicon.LookupRequest();
  request.conn = conn;
  request.url = url;

  const result_url = await favicon.lookup(request);
  const result_url_string = result_url ? result_url.href : undefined;
  const expected = 'https://www.oracle.com/favicon.ico';
  assert(result_url_string === expected);
  conn.close();
  await indexeddb_utils.remove(db_name);
}

export async function favicon_cache_open_test() {
  const db_name = favicon_cache_open_test.name;
  await indexeddb_utils.remove(db_name);
  const conn = await favicon.open(db_name);
  assert(typeof conn === 'object');
  assert(typeof conn.close === 'function');
  conn.close();
  await indexeddb_utils.remove(db_name);
}

export async function favicon_cache_put_find_test() {
  await indexeddb_utils.remove(favicon_cache_put_find_test.name);
  const conn = await favicon.open(favicon_cache_put_find_test.name);
  const entry = new favicon.Entry();
  entry.hostname = 'www.example.com';
  const put_result = await favicon.put_entry(conn, entry);
  const found_entry = await favicon.find_entry(conn, entry.hostname);
  assert(found_entry);
  assert(found_entry.hostname === entry.hostname);
  conn.close();
  await indexeddb_utils.remove(favicon_cache_put_find_test.name);
}

export async function favicon_cache_clear_test() {
  await indexeddb_utils.remove(favicon_cache_clear_test.name);
  const conn = await favicon.open(favicon_cache_clear_test.name);

  const num_inserted = 3;
  const create_promises = [];
  for (let i = 0; i < num_inserted; i++) {
    const entry = new favicon.Entry();
    entry.hostname = 'www.example' + i + '.com';
    create_promises.push(favicon.put_entry(conn, entry));
  }
  await Promise.all(create_promises);

  const pre_count = await count_entries(conn);
  assert(pre_count === num_inserted);
  await favicon.clear(conn);
  const post_count = await count_entries(conn);
  assert(post_count === 0);

  conn.close();
  await indexeddb_utils.remove(favicon_cache_clear_test.name);
}

// Insert a mix of expired and non-expired entries. Then run compact and check
// the expired entries are gone and the non-expired entries remain.
export async function favicon_cache_compact_test() {
  const db_name = favicon_cache_compact_test.name;
  await indexeddb_utils.remove(db_name);
  const conn = await favicon.open(db_name);

  const six_months = 1000 * 60 * 60 * 24 * 31 * 6;

  const create_promises = [];
  for (let i = 0; i < 10; i++) {
    const entry = new favicon.Entry();
    entry.hostname = 'www.example' + i + '.com';

    const now = new Date();
    if ((i % 2) === 0) {
      entry.expires = new Date(now.getTime() - six_months);
    } else {
      entry.expires = new Date(now.getTime() + six_months);
    }

    const promise = favicon.put_entry(conn, entry);
    create_promises.push(promise);
  }

  await Promise.all(create_promises);
  await favicon.compact(conn);

  const find_promises = [];
  for (let i = 0; i < 10; i++) {
    find_promises.push(favicon.find_entry(conn, 'www.example' + i + '.com'));
  }
  const results = await Promise.all(find_promises);
  for (let i = 0; i < 10; i++) {
    assert(i % 2 ? results[i] !== undefined : results[i] === undefined);
  }

  conn.close();
  await indexeddb_utils.remove(db_name);
}

// This is not part of the built in api. It would exist only for test purposes.
// So I violate abstraction here to get it. I think that is ok in test context
// which is allowed to know of internals. Keep in mind this may fail
// unexpectedly whenever favicon.js is modified. I might move this into
// favicon but am undecided.
function count_entries(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entries');
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entries');
    const request = store.count();
    request.onsuccess = _ => resolve(request.result);
  });
}
