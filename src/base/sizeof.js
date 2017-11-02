'use strict';

// Calculates the approximate byte size of a value. This should only be
// used for basic testing because it is hilariously inaccurate.
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
