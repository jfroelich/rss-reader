import assert from '/src/lib/assert.js';
import {open, remove} from '/src/lib/indexeddb-utils.js';

// Exercise a prototypical open, close, delete sequence. No errors should occur.
export async function indexeddb_utils_basic_test() {
  const conn = await open(indexeddb_utils_basic_test.name);
  conn.close();
  await remove(conn.name);
}

// Calling open without a name should fail
export async function indexeddb_utils_unnamed_test() {
  // to be really clear, the name param is not set
  let undefined_name = undefined;
  let conn;
  let expected_error;
  try {
    conn = await open(undefined_name);
  } catch (error) {
    expected_error = error;
  } finally {
    // try to release resources even in the unexpected case
    if (conn) {
      conn.close();
    }

    // try to cleanup even in the unexpected case
    if (conn && conn.name) {
      await remove(conn.name);
    }
  }

  // open should have produced some kind of error. do not care what kind of
  // error, just that it exists.
  assert(expected_error);
}

// does open behave as expected when given a kind of bad version
export async function indexeddb_utils_bad_version_test() {
  let expected_error;
  let conn;

  // indexedDB expects version to be positive integer. let's use a bad one.
  let bad_version = -1;

  try {
    conn = await open(bad_version_test.name, bad_version);
  } catch (error) {
    expected_error = error;
  } finally {
    if (conn) {
      conn.close();
      await remove(conn);
    }
  }

  // expected error should be something like the following: "TypeError: Failed
  // to execute 'open' on 'IDBFactory': Value is outside the 'unsigned long
  // long' value range." TypeError is a descendant of Error. I want to be a bit
  // more specific than defined object, but less specific that a particular kind
  // of error, in an (possibly futile) attempt to stay agnostic.
  assert(expected_error instanceof Error);
}

// Verify how indexedDB stores function objects
export async function indexeddb_utils_function_object_test() {
  // Really simple schema generator for test, never expects version change other
  // than the initial one
  const upgrade_handler = function(event) {
    const db = event.target.result;
    db.createObjectStore('objects', {keyPath: 'id', autoIncrement: true});
  };

  // Create a really basic database with an object store
  const conn = await open(
      'indexeddb-utils-function-object-test', undefined, upgrade_handler);

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

  // Storing should not produce an error
  try {
    await pp;
  } catch (error) {
    console.warn(error);
    assert(false, error.message);
  }

  // Get the object (eventually)
  const gp = new Promise((resolve, reject) => {
    const txn = conn.transaction('objects');
    const store = txn.objectStore('objects');
    const request = store.get(1);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });

  // Getting should not produce an error
  let robj;
  try {
    robj = await gp;
  } catch (error) {
    console.warn(error);
    assert(false, error.message);
  }

  conn.close();
  await remove(conn.name);
}
