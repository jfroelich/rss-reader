import assert from '/src/assert.js';
import * as indexeddb from '/src/indexeddb-utils.js';

// TODO: test upgrade handler specified vs not specified and assert that
// upgrade occurs
// TODO: test error paths like bad database name, bad version, etc

// Exercise the basic open, close, delete process
export async function indexeddb_test() {
  const conn = await indexeddb.open('indexeddb-test');
  conn.close();
  await indexeddb.remove(conn.name);
}

// This test asserts my understanding of the serialization. indexedDB can store
// function objects, because those objects are cloned during storage and during
// that cloning period it tolerates .prototype.method stuff, it is silently
// dropped. I would like to look into the spec where it says it does this.
// However, when reading the object back out, it loses all association with
// its constructor function, read objects are just plain objects. The key
// difference between my previous understanding and my current one is that
// indexedDB does in fact tolerate storing objects created by new Func(){}.
export async function indexeddb_function_object_test() {
  // Create a really basic database with an object store
  const conn = await indexeddb.open(
      'indexeddb-function-object-test', undefined, function(event) {
        const request = event.target;
        const db = request.result;
        if (!db.objectStoreNames.contains('objects')) {
          db.createObjectStore('objects', {keyPath: 'id', autoIncrement: true});
        }
      });

  // Define a class with a method
  function Foo() {
    this.a = 1;
  }
  Foo.prototype.bar = function() {
    this.a++;
  };

  // Store a function object
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
        resolve();
      };
    } catch (error) {
      reject(error);
    }
  });

  try {
    await pp;
  } catch (error) {
    console.warn(error);
    assert(false, error.message);
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
  } catch (error) {
    console.warn(error);
    assert(false, error.message);
  }

  conn.close();
  await indexeddb.remove(conn.name);
}
