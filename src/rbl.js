// Reader Base Library

// TODO: now that modules are available, importing is less of a hassle. This module should be
// broken up into individual modules again, and probably deprecated. But I am going to wait to do
// this until after successful transition to modules.

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
