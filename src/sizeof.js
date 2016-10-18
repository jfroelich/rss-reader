// See license.md

'use strict';

// Calculates the approximate size of a value in bytes. This should only be used
// for basic testing because it is hilariously inaccurate.
// Adapted from http://stackoverflow.com/questions/1248302
// Generally does not work on built-ins (dom, XMLHttpRequest, etc)
function sizeof(object) {
  const seen = [];
  const stack = [object];
  const has_own = Object.prototype.hasOwnProperty;
  const to_string = Object.prototype.to_string;
  let size = 0;
  while(stack.length) {
    const value = stack.pop();

    // NOTE: typeof null === 'object'
    if(value === null) {
      continue;
    }

    switch(typeof value) {
      case 'undefined':
        break;
      case 'boolean':
        size += 4;
        break;
      case 'string':
        size += value.length * 2;
        break;
      case 'number':
        size += 8;
        break;
      case 'function':
        size += 2 * value.to_string().length;
        break;
      case 'object':
        if(seen.indexOf(value) === -1) {
          seen.push(value);
          if(ArrayBuffer.isView(value)) {
            size += value.length;
          } else if(Array.isArray(value)) {
            stack.push(...value);
          } else {
            const to_string_output = to_string.call(value);
            if(to_string_output === '[object Date]') {
              size += 8;// guess
            } else if(to_string_output === '[object URL]') {
              size += 2 * value.href.length;// guess
            } else {
              for(let prop in value) {
                if(has_own.call(value, prop)) {
                  size += prop.length * 2;// prop name
                  stack.push(value[prop]);
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

  return size;
}
