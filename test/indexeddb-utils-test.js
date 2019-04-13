import assert from '/lib/assert.js';
import { open, remove } from '/lib/indexeddb-utils.js';

// Exercise a prototypical open, close, delete sequence. No errors should occur.
export async function indexedDBUtilsBasicTest() {
  const conn = await open(indexedDBUtilsBasicTest.name);
  conn.close();
  await remove(indexedDBUtilsBasicTest.name);
}

// Assert that my understanding of old version is correct
export async function indexedDBUtilsOldVersionTest() {
  let oldVersion;
  let newVersion;

  const initialHandler = (event) => {
    // eslint-disable-next-line prefer-destructuring
    oldVersion = event.oldVersion;
    newVersion = event.target.result.version;
  };

  // Call without a version
  const conn = await open(indexedDBUtilsOldVersionTest.name, undefined, initialHandler);
  conn.close();

  // When creating the database for the first time, the old version will be 0
  assert(oldVersion === 0);

  // When creating the database for the first time without specifying a version,
  // the new version will be 1
  assert(newVersion === 1);

  await remove(indexedDBUtilsOldVersionTest.name);
}

// Calling open without a name should fail
export async function indexedDBUtilsUnnamedTest() {
  // to be really clear, the name param is not set
  let undefinedName;
  let conn;
  let expectedError;
  try {
    conn = await open(undefinedName);
  } catch (error) {
    expectedError = error;
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
  assert(expectedError);
}

// does open behave as expected when given a kind of bad version
export async function indexedDBUtilsBadVersionTest() {
  let expectedError;
  let conn;

  // indexedDB expects version to be positive integer. let's use a bad one.
  const badVersion = -1;

  try {
    conn = await open(indexedDBUtilsBadVersionTest.name, badVersion);
  } catch (error) {
    expectedError = error;
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
  assert(expectedError instanceof Error);
}

// Verify how indexedDB stores function objects
export async function indexedDBUtilsFunctionObjectTest() {
  // Really simple schema generator for test, never expects version change other
  // than the initial one
  const upgradeHandler = function (event) {
    const db = event.target.result;
    db.createObjectStore('objects', { keyPath: 'id', autoIncrement: true });
  };

  // Create a really basic database with an object store
  const conn = await open(
    'indexeddb-utils-function-object-test', undefined, upgradeHandler
  );

  // Define a class with a method
  function Foo() {
    this.a = 1;
  }
  Foo.prototype.bar = function () {
    this.a += 1;
  };

  // Store a function object
  const pp = new Promise((resolve, reject) => {
    try {
      const txn = conn.transaction('objects', 'readwrite');
      txn.onerror = (event) => {
        reject(event.target.error);
      };

      const store = txn.objectStore('objects');

      const obj = new Foo();
      const request = store.put(obj);
      request.onsuccess = () => {
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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // Getting should not produce an error
  try {
    await gp;
  } catch (error) {
    console.warn(error);
    assert(false, error.message);
  }

  conn.close();
  await remove('indexeddb-utils-function-object-test');
}
