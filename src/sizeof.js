// See license.md

'use strict';

// Calculates the approximate byte size of a value. This should only be
// used for basic testing because it is hilariously inaccurate.
// Adapted from http://stackoverflow.com/questions/1248302
// Generally does not work on built-ins (dom, XMLHttpRequest, etc)
// This uses a stack internally to avoid recursion
// @param inputValue any input value
// @returns an integer representing the approximate byte size of the input
// value
function sizeof(inputValue) {
  const visitedObjectsArray = [];
  const stack = [inputValue];
  const hasOwnProp = Object.prototype.hasOwnProperty;
  const toString = Object.prototype.toString;

  let byteSize = 0;

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
        byteSize += 4;
        break;
      case 'string':
        byteSize += value.length * 2;
        break;
      case 'number':
        byteSize += 8;
        break;
      case 'function':
        // Treat as some kind of function identifier
        byteSize += 8;
        break;
      case 'object':
        if(visitedObjectsArray.indexOf(value) === -1) {
          visitedObjectsArray.push(value);

          if(ArrayBuffer.isView(value)) {
            byteSize += value.length;
          } else if(Array.isArray(value)) {
            stack.push(...value);
          } else {
            const toStringOutput = toString.call(value);
            if(toStringOutput === '[object Date]') {
              byteSize += 8;// guess
            } else if(toStringOutput === '[object URL]') {
              byteSize += 2 * value.href.length;// guess
            } else {
              for(let propertyName in value) {
                if(hasOwnProp.call(value, propertyName)) {
                  // Add size of the property name string itself
                  byteSize += propertyName.length * 2;
                  stack.push(value[propertyName]);
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

  return byteSize;
}
