// Reader Base Library

// TODO: now that modules are available, importing is less of a hassle. This module should be
// broken up into individual modules again, and probably deprecated. But I am going to wait to do
// this until after successful transition to modules.

const ASSERT_LOG_ERRORS = true;
const INDEXEDDB_DEBUG = false;

class AssertionError extends Error {
  constructor(message) {
    super(message || 'Assertion failed');
  }
}

// @throws {AssertionError}
export function assert(condition, message) {
  if(!condition) {
    const error = new AssertionError(message);

    if(ASSERT_LOG_ERRORS) {
      console.error(error);
    }

    throw error;
  }
}

// @throws {AssertionError}
export function formatDate(date, delimiter) {
  // Tolerate some forms bad input
  if(!date) {
    return '';
  }

  assert(date instanceof Date);
  const parts = [];
  // Add 1 because getMonth is a zero based index
  parts.push(date.getMonth() + 1);
  parts.push(date.getDate());
  parts.push(date.getFullYear());
  return parts.join(delimiter || '/');
}

// @param file {File}
// @returns {Promise}
export function readFileAsText(file) {
  assert(file instanceof File);
  return new Promise(function executor(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}

// Returns true if the conn is open. This should only be used with indexedDB
// databases opened by this library.
// @param conn {IDBDatabase}
export function isOpenDB(conn) {
  return conn instanceof IDBDatabase && conn.onabort;
}

// Wraps a call to indexedDB.open that imposes a time limit and translates
// blocked events into errors.
//
// @param name {String}
// @param version {Number} optional
// @param upgradeListener {Function} optional, react to upgradeneeded events
// @param timeoutMs {Number} optional, positive integer, how long to wait
// in milliseconds before giving up on connecting
// @throws {Error} if connection error or timeout occurs
export async function openDB(name, version, upgradeListener, timeoutMs) {
  assert(typeof name === 'string');

  if(isNaN(timeoutMs)) {
    timeoutMs = 0;
  }
  assert(isPosInt(timeoutMs));

  let timedout = false;
  let timer;

  const openPromise = new Promise(function openExecutor(resolve, reject) {
    if(INDEXEDDB_DEBUG) {
      console.debug('connecting to database', name, version);
    }

    let blocked = false;
    const request = indexedDB.open(name, version);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      if(blocked) {
        console.log('closing connection %s that unblocked', conn.name);
        conn.close();
      } else if(timedout) {
        console.log('closing connection %s opened after timeout', conn.name);
        conn.close();
      } else {
        if(INDEXEDDB_DEBUG) {
          console.debug('connected to database', name, version);
        }

        // Use the onabort listener property as a flag to indicate to
        // isOpenDB that the connection is currently open
        conn.onabort = function noop() {};

        // NOTE: this is only invoked if force closed by error
        conn.onclose = function() {
          conn.onabort = undefined;
          console.log('connection was forced closed', conn.name);
        };

        resolve(conn);
      }
    };

    request.onblocked = function(event) {
      blocked = true;
      const errorMessage = name + ' blocked';
      const error = new Error(errorMessage);
      reject(error);
    };

    request.onerror = () => reject(request.error);

    // NOTE: an upgrade can still happen in the event of a rejection. I am
    // not trying to prevent that as an implicit side effect, although it is
    // possible to abort the versionchange transaction from within the
    // upgrade listener. If I wanted to do that I would wrap the call to the
    // listener here with a function that first checks if blocked/timedout
    // and if so aborts the transaction and closes, otherwise forwards to the
    // listener.
    request.onupgradeneeded = upgradeListener;
  });

  if(!timeoutMs) {
    // Ordinarily it would make sense to just return the promise. However, the
    // await pulls out a promise rejection and translates it into an uncaught
    // exception, which we allow to bubble.
    return await openPromise;
  }

  let timeoutPromise;
  [timer, timeoutPromise] = setTimeoutPromise(timeoutMs);

  // Allow exception to bubble
  const conn = await Promise.race([openPromise, timeoutPromise]);

  if(conn) {
    clearTimeout(timer);
  } else {
    timedout = true;

    // TODO: create and use a TimedOutError or something along those lines
    const errorMessage = 'connecting to database ' + name + ' timed out';
    throw new Error(errorMessage);
  }

  return conn;
}

// Requests to close 0 or more indexedDB connections
// @param {...IDBDatabase}
export function closeDB(...conns) {
  // NOTE: undefined conns does not raise an error, the loop simply never
  // iterates.
  for(const conn of conns) {
    // This is routinely called in a finally block, so try never to throw
    if(conn && conn instanceof IDBDatabase) {
      if(INDEXEDDB_DEBUG) {
        console.debug('closing connection to database', conn.name);
      }

      // Ensure that isOpenDB returns false
      conn.onabort = null;
      conn.close();
    }
  }
}

export function deleteDB(name) {
  return new Promise(function executor(resolve, reject) {
    console.debug('deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Returns true if the input value is a positive integer
// Returns false for NaN
// Returns false for Number.POSITIVE_INFINITY
// Returns true for 0
export function isPosInt(number) {
  return Number.isInteger(number) && number >= 0;
}

const BASE_10_RADIX = 10;

// Wraps parseInt with a base 10 parameter. This is both convenient and avoids
// surprising parse results (such as when parsing '010').

export function parseInt10(number) {
  return parseInt(number, BASE_10_RADIX);
}

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it is null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Shallow copy by reference.
export function filterEmptyProps(object) {
  const hasOwnProp = Object.prototype.hasOwnProperty;
  const output = {};
  let undef;

  if(typeof object === 'object') {
    for(const key in object) {
      if(hasOwnProp.call(object, key)) {
        const value = object[key];
        if(value !== undef && value !== null && value !== '') {
          output[key] = value;
        }
      }
    }
  }

  return output;
}

// Returns a promise that resolves to undefined after a certain amount of time,
// as well as the timer id. This returns an array so that the caller can use
// destructuring such as const [t,p] = setTimeoutPromise(n);
// @param timeoutMs {Number} milliseconds, must be >= 0, the browser may
// choose to take longer than specified
export function setTimeoutPromise(timeoutMs) {
  assert(isPosInt(timeoutMs));

  // Note this is special behavior and different than calling setTimeout with
  // a value of 0, because the browser may take even longer.
  if(timeoutMs === 0) {
    const FAKE_TIMEOUT_ID = 0;
    const FAKE_RESOLVED_PROMISE = Promise.resolve();
    return [FAKE_TIMEOUT_ID, FAKE_RESOLVED_PROMISE];
  }

  let timeoutId;
  const promise = new Promise(function executor(resolve, reject) {
    timeoutId = setTimeout(resolve, timeoutMs);
  });
  return [timeoutId, promise];
}

// A variant of Promise.all that does not shortcircuit. If any promise rejects,
// undefined is placed in the output array in place of the promise's return
// value.
export async function promiseEvery(promises) {
  assert(Array.isArray(promises));
  const results = [];
  for(const promise of promises) {
    let result;
    try {
      result = await promise;
    } catch(error) {
      if(isUncheckedError(error)) {
        throw error;
      } else {
        // Prevent the error from bubbling by ignoring it.
        console.debug('iteration skipped error', error);
      }
    }

    results.push(result);
  }

  return results;
}

// Returns a new string object where sequences of whitespace characters in the
// input string are replaced with a single space character.
// @param {String} an input string
// @throws {Error} if input is not a string
// @returns {String} a condensed string
export function condenseWhitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

export function filterWhitespace(string) {
  return string.replace(/\s+/g, '');
}

// From the start of the string to its end, if one or more of the characters is not in the
// class of alphanumeric characters, then the string is not alphanumeric.
// See https://stackoverflow.com/questions/4434076
// See https://stackoverflow.com/questions/336210
// The empty string is true, null/undefined are true
// Does NOT support languages other than English
export function isAlphanumeric(string) {
  return /^[a-zA-Z0-9]*$/.test(string);
}

// Returns a new string where Unicode Cc-class characters have been removed.
// Throws an error if string is not a defined string.
// Adapted from these stack overflow questions:
// http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
export function filterControls(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}

// Returns an array of word token strings.
// @param string {String}
// @returns {Array} an array of tokens
export function tokenize(string) {
  // Rather than make any assertions about the input, tolerate bad input for
  // the sake of caller convenience.
  if(typeof string !== 'string') {
    return [];
  }

  // Trim to avoid leading/trailing space leading to empty tokens
  const trimmedInput = string.trim();

  // Special case for empty string to avoid producing empty token
  if(!trimmedInput) {
    return [];
  }

  return trimmedInput.split(/\s+/g);
}

// Calculates the approximate byte size of a value. This should only be
// used for informational purposes because it is hilariously inaccurate.
//
// Adapted from http://stackoverflow.com/questions/1248302
//
// Does not work with built-ins, which are objects that are a part of the
// basic Javascript library, like Document, or Element.
//
// This uses a stack internally to avoid recursion
//
// @param inputValue {Any} a value of any type
// @returns {Number} an integer representing the approximate byte size of the
// input value
export function sizeof(inputValue) {
  // visitedObjects is a memoization of previously visited objects. In theory
  // a repeated object just means enough bytes to store a reference value,
  // and only the first object actually allocates additional memory.
  const visitedObjects = [];
  const stack = [inputValue];
  const hasOwnProp = Object.prototype.hasOwnProperty;
  const objectToString = Object.prototype.toString;

  let byteCount = 0;

  while(stack.length) {
    const value = stack.pop();

    // typeof null === 'object'
    if(value === null) {
      continue;
    }

    switch(typeof value) {
    case 'undefined':
      break;
    case 'boolean':
      byteCount += 4;
      break;
    case 'string':
      byteCount += value.length * 2;
      break;
    case 'number':
      byteCount += 8;
      break;
    case 'function':
      // Treat as some kind of function identifier
      byteCount += 8;
      break;
    case 'object':
      if(visitedObjects.indexOf(value) === -1) {
        visitedObjects.push(value);

        if(ArrayBuffer.isView(value)) {
          byteCount += value.length;
        } else if(Array.isArray(value)) {
          stack.push(...value);
        } else {
          const toStringOutput = objectToString.call(value);
          if(toStringOutput === '[object Date]') {
            byteCount += 8; // guess
          } else if(toStringOutput === '[object URL]') {
            byteCount += 2 * value.href.length; // guess
          } else {
            for(let propName in value) {
              if(hasOwnProp.call(value, propName)) {
                // Add size of the property name string itself
                byteCount += propName.length * 2;
                stack.push(value[propName]);
              }
            }
          }
        }
      }
      break;
    default:
      break;// ignore
    }
  }

  return byteCount;
}

// TODO: move to errors.js
export function isUncheckedError(error) {
  return error instanceof AssertionError ||
    error instanceof TypeError ||
    error instanceof ReferenceError;
}

// TODO: move to errors.js
export class ParserError extends Error {
  constructor(message) {
    super(message || 'Parse error');
  }
}

// TODO: move to errors.js
export class PermissionsError extends Error {
  constructor(message) {
    super(message || 'Not permitted');
  }
}
