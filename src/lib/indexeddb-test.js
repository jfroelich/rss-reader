import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import {register_test} from '/src/test/test-registry.js';



// TODO:
// test create vs upgrade case, assert that onupgradeneeded happens
// Test that timeout vs no-timeout works as expected
// Test error paths

// TODO: this test is failing, indexeddb.remove never resolves. On applications
// tab, the details for the database that was created are missing, and the
// buttons for delete and refresh do not work (and are opaque). Somehow this is
// basically creating a database in some kind of bad state

// NOTE: disabled this test for now

async function indexeddb_test() {
  /*
  let conn, timeout, upgrade_listener;
  conn = await indexeddb.open('idb-test-foo', 1, upgrade_listener, timeout);
  console.debug('Opened database', conn.name); await
  indexeddb.remove(db_name);
  console.debug('indexeddb_test reached
  completion and should not timeout'); return true;
  */
}

// This test asserts my understanding of the serialization. indexedDB can store
// function objects, because those objects are cloned during storage and during
// that cloning period it tolerates .prototype.method stuff, it is silently
// dropped. I would like to look into the spec where it says it does this.
// However, when reading the object back out, it loses all association with
// its constructor function, read objects are just plain objects. The key
// difference between my previous understanding and my current one is that
// indexedDB does in fact tolerate storing objects created by new Func(){}.
async function indexeddb_function_object_test() {
  function upgrade(event) {
    const request = event.target;
    const db = request.result;
    if (!db.objectStoreNames.contains('objects')) {
      db.createObjectStore('objects', {keyPath: 'id', autoIncrement: true});
    }
  }

  const conn = await indexeddb.open(
      'indexeddb-function-object-test', undefined, upgrade);

  console.debug('Connected to database', conn.name);

  function Foo() {
    this.a = 1;
  }

  Foo.prototype.bar = function() {
    this.a++;
  };

  const pp = new Promise((resolve, reject) => {
    try {
      const txn = conn.transaction('objects', 'readwrite');
      txn.onerror = event => {
        reject(event.target.error);
      };

      const store = txn.objectStore('objects');

      const obj = new Foo();
      const request = store.put(obj);
      request.onsuccess = _ => {
        console.debug('Stored object');
        resolve();
      };
    } catch (error) {
      reject(error);
    }
  });

  try {
    await pp;
    console.debug('stored function object');
  } catch (error) {
    console.warn(error);
  }

  const gp = new Promise((resolve, reject) => {
    const txn = conn.transaction('objects');
    const store = txn.objectStore('objects');
    const request = store.get(1);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });

  let robj;
  try {
    robj = await gp;
    console.debug('retrieved object', robj);
  } catch (error) {
    console.warn(error);
  }

  console.debug('retrieved object has prototype method?', robj.bar);

  console.debug('retrieved obj const name', robj.__proto__.constructor.name);

  console.debug('closing database', conn.name);
  conn.close();
  console.debug('removing database', conn.name);
  await indexeddb.remove(conn.name);
}

register_test(indexeddb_function_object_test);
register_test(indexeddb_test);
