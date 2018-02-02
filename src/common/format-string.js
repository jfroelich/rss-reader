// string_format returns a formatted string, similar to printf
// Flags are case sensitive
// %s - string
// %d - number
// %o - object
// %% - literal '%'

const syntaxPattern = /%[sdo%]/g;

export default function string_format(...args) {
  const argCount = args.length;
  if (argCount === 0) {
    return '';
  }

  let argIndex = 0;
  const formatArg = args[argIndex];
  if (typeof formatArg !== 'string') {
    return args.map(anyTypeToStringString).join(' ');
  }

  argIndex++;

  if (argIndex === argCount) {
    return formatArg;
  }

  // Walk over each formatting argument thing in the format string, and replace
  // it with one of the remaining arguments. We know there is at least one
  // other argument.
  const replacedString =
      formatArg.replace(syntaxPattern, function replacer(match) {
        // If we've reached or moved past the end, then there are more
        // occurrences of formatting codes than arguments. Stop doing any
        // replacements.
        if (argIndex >= argCount) {
          return match;
        }

        // Replace the matched formatting code with the current argument, and
        // advance the argument index to the next argument. The post-increment
        // occurs after the value is read
        switch (match) {
          case '%%':
            return '%';
          case '%s':
            return anyTypeToStringString(args[argIndex++]);
          case '%d':
            return anyTypeToNumberString(args[argIndex++]);
          case '%o':
            return anyTypeToObjectString(args[argIndex++]);
          default:
            return match;
        }
      });

  // Exit early if all arguments processed
  if (argIndex >= argCount) {
    return replacedString;
  }

  // There may be more arguments to the function than there are codes to
  // replace in the format string. Some of the arguments were used to do
  // replacements so far, but possibly not all of the arguments have been used.
  // Append the remaining unused arguments to a buffer, then join them.
  // This still works even if the above check was not present.
  const buffer = [replacedString];
  while (argIndex < argCount) {
    buffer.push(anyTypeToStringString(args[argIndex++]));
  }
  return buffer.join(' ');
}

function anyTypeToNumberString(value) {
  if (typeof value === 'number') {
    if (Object.is(value, -0)) {
      // Special case for negative zero because otherwise ('' + -0) yields '0'.
      // This matches console.log behavior.
      return '-0';
    } else {
      // Convert the number to a string. I've chosen this syntax because
      // apparently it is faster than calling the String constructor (either as
      // a function or a constructor function).
      return '' + value;
    }
  } else {
    return 'NaN';
  }
}

// Cache the reference to the native function so that the property lookup does
// not occur each time anyTypeToObjectString is evaluated.
const nativeHasOwn = Object.prototype.hasOwnProperty;

// Convert an object into a string. This does not assume the input is an object.
function anyTypeToObjectString(value) {
  // typeof null === 'object', so special case for null. Cannot assume caller
  // already checked for this situation.
  if (value === null) {
    return 'null';
  }

  // NOTE: special case for undefined. Without this case, the call to
  // nativeHasOwn.call below would throw an exception "TypeError: Cannot
  // convert undefined or null to object"
  // NOTE: undefined === void 0
  // NOTE: do not use void(0), void is an operator, not a function
  if (value === void 0) {
    return 'undefined';
  }

  // Do not delegate to JSON.stringify because that wraps string in quotes
  if (typeof value === 'string') {
    return value;
  }

  // Handle date specifically, do not delegate to JSON.stringify
  if (value instanceof Date) {
    return value.toString();
  }

  // All objects subclass Object. And Object has a default toString
  // implementation. So simply checking value.toString is wrong, because that
  // property lookup will eventually go up the prototype chain and find
  // Object.prototype.toString. Therefore, we want to test if the object itself
  // has a toString method defined using the hasOwnProperty method. But,
  // we don't want to use value.hasOwnProperty, because the value may have
  // messed with it. So we use the native hasOwnProperty call of the base
  // Object object. Which also may have been messed with but at that point it is
  // overly-defensive.

  if (nativeHasOwn.call(value, 'toString')) {
    return value.toString();
  }

  // NOTE: url.hasOwnProperty('toString') === false, so it is ok to perform
  // this after checking hasOwn above
  // Url is not serializable by stringify
  if (value instanceof URL) {
    return value.href;
  }

  // functions are not serializable by stringify
  if (typeof value === 'function') {
    return value.toString();
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return '{Object(Uncoercable)}';
  }
}

// Convert a value of an unknown type into a string
function anyTypeToStringString(value) {
  if (value === null) {
    return 'null';
  }

  const type = typeof value;
  switch (type) {
    case 'undefined':
      return 'undefined';
    case 'function':
      return value.toString();
    case 'number':
      return anyTypeToNumberString(value);
    case 'string':
      return value;
    case 'object':
      return anyTypeToObjectString(value);
    default:
      return '' + value;
  }
}
