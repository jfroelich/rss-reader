// Memory usage lib

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
// @param input_value {Any} a value of any type
// @returns {Number} an integer representing the approximate byte size of the
// input value
function sizeof(input_value) {
  // visited_objects is a memoization of previously visited objects. In theory
  // a repeated object just means enough bytes to store a reference value,
  // and only the first object actually allocates additional memory.
  const visited_objects = [];
  const stack = [input_value];
  const has_own_prop = Object.prototype.hasOwnProperty;
  const to_string = Object.prototype.toString;

  let byte_size = 0;

  while(stack.length) {
    const value = stack.pop();

    // typeof null === 'object'
    if(value === null)
      continue;

    switch(typeof value) {
      case 'undefined':
        break;
      case 'boolean':
        byte_size += 4;
        break;
      case 'string':
        byte_size += value.length * 2;
        break;
      case 'number':
        byte_size += 8;
        break;
      case 'function':
        // Treat as some kind of function identifier
        byte_size += 8;
        break;
      case 'object':
        if(visited_objects.indexOf(value) === -1) {
          visited_objects.push(value);

          if(ArrayBuffer.isView(value))
            byte_size += value.length;
          else if(Array.isArray(value))
            stack.push(...value);
          else {
            const to_string_output = to_string.call(value);
            if(to_string_output === '[object Date]') {
              byte_size += 8; // guess
            } else if(to_string_output === '[object URL]') {
              byte_size += 2 * value.href.length; // guess
            } else {
              for(let prop_name in value) {
                if(has_own_prop.call(value, prop_name)) {
                  // Add size of the property name string itself
                  byte_size += prop_name.length * 2;
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

  return byte_size;
}
