import assert from '/src/base/assert.js';
import * as cache from '/src/base/favicon-service/cache.js';
import * as indexeddb from '/src/base/indexeddb.js';

export async function favicon_cache_open_test() {
  const db_name = favicon_cache_open_test.name;
  await indexeddb.remove(db_name);
  const conn = await cache.open(db_name, undefined, 0);
  assert(typeof conn === 'object');
  assert(typeof conn.close === 'function');
  conn.close();
  await indexeddb.remove(db_name);
}

export async function favicon_cache_put_find_test() {
  const db_name = favicon_cache_put_find_test.name;
  await indexeddb.remove(db_name);
  const conn = await cache.open(db_name);
  const entry = new cache.Entry();
  entry.hostname = 'www.example.com';
  const put_result = await cache.put_entry(conn, entry);
  const found_entry = await cache.find_entry(conn, entry.hostname);
  assert(found_entry);
  assert(found_entry.hostname === entry.hostname);
  conn.close();
  await indexeddb.remove(db_name);
}

export async function favicon_cache_clear_test() {
  const db_name = favicon_cache_clear_test.name;
  await indexeddb.remove(db_name);
  const conn = await cache.open(db_name);

  const num_inserted = 3;
  const create_promises = [];
  for (let i = 0; i < num_inserted; i++) {
    const entry = new cache.Entry();
    entry.hostname = 'www.example' + i + '.com';
    create_promises.push(cache.put_entry(conn, entry));
  }
  await Promise.all(create_promises);

  const pre_count = await count_entries(conn);
  assert(pre_count === num_inserted);
  await cache.clear(conn);
  const post_count = await count_entries(conn);
  assert(post_count === 0);

  conn.close();
  await indexeddb.remove(db_name);
}

// Insert a mix of expired and non-expired entries. Then run compact and check
// the expired entries are gone and the non-expired entries remain.
export async function favicon_cache_compact_test() {
  const db_name = favicon_cache_compact_test.name;
  await indexeddb.remove(db_name);
  const conn = await cache.open(db_name);

  const six_months = 1000 * 60 * 60 * 24 * 31 * 6;

  const create_promises = [];
  for (let i = 0; i < 10; i++) {
    const entry = new cache.Entry();
    entry.hostname = 'www.example' + i + '.com';

    const now = new Date();
    if ((i % 2) === 0) {
      entry.expires = new Date(now.getTime() - six_months);
    } else {
      entry.expires = new Date(now.getTime() + six_months);
    }

    const promise = cache.put_entry(conn, entry);
    create_promises.push(promise);
  }

  await Promise.all(create_promises);
  await cache.compact(conn);

  const find_promises = [];
  for (let i = 0; i < 10; i++) {
    find_promises.push(cache.find_entry(conn, 'www.example' + i + '.com'));
  }
  const results = await Promise.all(find_promises);
  for (let i = 0; i < 10; i++) {
    assert(i % 2 ? results[i] !== undefined : results[i] === undefined);
  }

  conn.close();
  await indexeddb.remove(db_name);
}

// This is not part of the built in api. It would exist only for test purposes.
// So I violate abstraction here to get it. I think that is ok in test context
// which is allowed to know of internals. Keep in mind this may fail
// unexpectedly whenever cache.js is modified. I might move this into cache
// but am undecided.
function count_entries(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entries');
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entries');
    const request = store.count();
    request.onsuccess = _ => resolve(request.result);
  });
}
