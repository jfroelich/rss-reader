'use strict';

// Reader Base Library

// Directly in global scope due to frequency of use and its rather distinctive
// role
function assert(condition, message) {
  if(!condition) {
    const error = new AssertionError(message);
    // Always log in case the assertion is swallowed
    console.error(error);
    throw error;
  }
}


const rbl = {};

rbl.formatDate = function(date, delimiter) {
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
};

rbl.readFileAsText = function(file) {
  assert(file instanceof File);
  return new Promise(function executor(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
};


// Returns true if the conn is open. This should only be used with indexedDB
// connections created by this module.
// @param conn {IDBDatabase}
rbl.isOpenDB = function(conn) {
  return conn instanceof IDBDatabase && conn.onabort;
};


// Wraps a call to indexedDB.open that imposes a time limit and translates
// blocked events into errors.
//
// @param name {String}
// @param version {Number} optional
// @param upgradeListener {Function} optional, react to upgradeneeded events
// @param timeoutMs {Number} optional, positive integer, how long to wait
// in milliseconds before giving up on connecting
// @throws {Error} if connection error or timeout occurs
rbl.openDB = async function(name, version, upgradeListener, timeoutMs) {
  assert(typeof name === 'string');

  if(isNaN(timeoutMs)) {
    timeoutMs = 0;
  }
  assert(rbl.isPosInt(timeoutMs));

  let timedout = false;
  let timer;

  const openPromise = new Promise(function openExecutor(resolve, reject) {
    console.log('connecting to database', name, version);
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
        console.log('connected to database', name, version);

        // Use the onabort listener property as a flag to indicate to
        // rbl.isOpenDB that the connection is currently open
        conn.onabort = function noop() {};

        // NOTE: this is only invoked if force closed by error
        conn.onclose = function() {
          conn.onabort = undefined;
          console.log('closing connection', conn.name);
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
    // Allow exception to bubble
    return await openPromise;
  }

  let timeoutPromise;
  [timer, timeoutPromise] = rbl.timeoutPromise(timeoutMs);

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
};

// Requests to close 0 or more connections
// @param {...IDBDatabase}
rbl.closeDB = function(...conns) {
  for(const conn of conns) {
    // This is routinely called in a finally block, so try never to throw
    if(conn && conn instanceof IDBDatabase) {
      console.debug('closing connection to database', conn.name);
      // Ensure that rbl.isOpenDB returns false
      conn.onabort = null;
      conn.close();
    }
  }
};

rbl.deleteDB = function(name) {
  return new Promise(function executor(resolve, reject) {
    console.debug('deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Returns true if the input value is a positive integer
// Returns false for NaN
// Returns false for Number.POSITIVE_INFINITY
// Returns true for 0
rbl.isPosInt = function(number) {
  return Number.isInteger(number) && number >= 0;
};

// TODO: replace all parseInt calls with this function
rbl.parseInt10 = function(number) {
  const RADIX = 10;
  return parseInt(number, RADIX);
};

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it is null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Shallow copy by reference.
rbl.filterEmptyProps = function(object) {
  const hasOwnProp = Object.prototype.hasOwnProperty;
  const output = {};

  if(typeof object === 'object') {
    for(const key in object) {
      if(hasOwnProp.call(object, key)) {
        const value = object[key];
        if(value !== undefined && value !== null && value !== '') {
          output[key] = value;
        }
      }
    }
  }

  return output;
};


// Returns a promise that resolves to undefined after a certain amount of time,
// as well as the timer id. This returns an array so that the caller can use
// destructuring such as const [t,p] = rbl.timeoutPromise(n);
// @param timeoutMs {Number} milliseconds, should be >= 0, the browser may
// choose to take longer than specified
rbl.timeoutPromise = function(timeoutMs) {
  assert(rbl.isPosInt(timeoutMs));
  let timeoutId;
  const promise = new Promise(function executor(resolve, reject) {
    timeoutId = setTimeout(resolve, timeoutMs);
  });
  return [timeoutId, promise];
};

// A variant of Promise.all that does not shortcircuit. If any promise rejects,
// undefined is placed in the output array in place of the promise's return
// value.
rbl.promiseEvery = async function(promises) {
  assert(Array.isArray(promises));
  const results = [];
  for(const promise of promises) {
    let result;
    try {
      result = await promise;
    } catch(error) {
      if(error instanceof AssertionError) {
        throw error;
      }
    }

    results.push(result);
  }

  return results;
};

// Returns a new string object where sequences of whitespace characters in the
// input string are replaced with a single space character.
// @param {String} an input string
// @throws {Error} if input is not a string
// @returns {String} a condensed string
rbl.condenseWhitespace = function(string) {
  return string.replace(/\s{2,}/g, ' ');
};

rbl.removeWhitespace = function(string) {
  return string.replace(/\s+/g, '');
};

// Returns a new string where Unicode Cc-class characters have been removed.
// Throws an error if string is not a defined string.
// Adapted from these stack overflow questions:
// http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
rbl.filterControls = function(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
};

// Returns an array of word token strings.
// @param string {String}
// @returns {Array} an array of tokens
rbl.tokenize = function(string) {
  // Rather than make any assertions about the input, tolerate bad input for
  // the sake of caller convenience.
  if(typeof string !== 'string') {
    return [];
  }

  // Trim to avoid leading/trailing space leading to empty tokens
  const trimmed_input = string.trim();

  // Special case for empty string to avoid producing empty token
  if(!trimmed_input) {
    return [];
  }

  return trimmed_input.split(/\s+/g);
};

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
function sizeof(inputValue) {
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
            for(let prop_name in value) {
              if(hasOwnProp.call(value, prop_name)) {
                // Add size of the property name string itself
                byteCount += prop_name.length * 2;
                stack.push(value[prop_name]);
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


// Global errors

class AssertionError extends Error {
  constructor(message) {
    super(message || 'Assertion failed');
    //Error.captureStackTrace(this, this.constructor.name);
  }
}

class ParserError extends Error {
  constructor(message) {
    super(message || 'Parse error');
  }
}

// TODO: stop using reader prefix
class ReaderPermissionsError extends Error {
  constructor(message) {
    super(message || 'Not permitted');
  }
}
