/*

# sizeof
The `sizeof` function calculates the approximate byte size of a value. This
should only be used for informational purposes because it is hilariously
inaccurate. Adapted from http://stackoverflow.com/questions/1248302.

The sizeof function generally does not work with built-ins, which are objects
that are a part of the basic Javascript library, like Document, or Element.
There are a few built-ins that are supported, such as URL.

This uses a stack internally to avoid recursion. I actually have not returned to
benchmark whether the non-recursive implementation beats the recursive
implementation.


*/

export function sizeof(input_value) {
  // visited_objects is a memoization of previously visited objects. In theory a
  // repeated object just means enough bytes to store a reference value, and
  // only the first object actually allocates additional memory.
  const visited_objects = [];
  const stack = [input_value];
  const has_own_prop = Object.prototype.hasOwnProperty;
  const object_to_string = Object.prototype.toString;

  let sz = 0;

  while (stack.length) {
    const value = stack.pop();

    // typeof null === 'object'
    if (value === null) {
      continue;
    }

    switch (typeof value) {
      case 'undefined':
        break;
      case 'boolean':
        sz += 4;
        break;
      case 'string':
        sz += value.length * 2;
        break;
      case 'number':
        sz += 8;
        break;
      case 'function':
        // Treat as some kind of function identifier
        sz += 8;
        break;
      case 'object':
        if (visited_objects.indexOf(value) === -1) {
          visited_objects.push(value);

          if (ArrayBuffer.isView(value)) {
            sz += value.length;
          } else if (Array.isArray(value)) {
            stack.push(...value);
          } else {
            const to_string_output = object_to_string.call(value);
            if (to_string_output === '[object Date]') {
              sz += 8;  // guess
            } else if (to_string_output === '[object URL]') {
              sz += 2 * value.href.length;  // guess
            } else {
              for (let prop_name in value) {
                if (has_own_prop.call(value, prop_name)) {
                  // Add size of the property name string itself
                  sz += prop_name.length * 2;
                  stack.push(value[prop_name]);
                }
              }
            }
          }
        }
        break;
      default:
        break;  // ignore
    }
  }

  return sz;
}
