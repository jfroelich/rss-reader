// string_format returns a formatted string, similar to printf
// Flags are case sensitive
// %s - string
// %d - number
// %o - object
// %% - literal '%'

const syntax_pattern = /%[sdo%]/g;

export default function string_format(...args) {
  const arg_count = args.length;
  if (arg_count === 0) {
    return '';
  }

  let arg_index = 0;
  const format_arg = args[arg_index];
  if (typeof format_arg !== 'string') {
    return args.map(any_type_to_string_string).join(' ');
  }

  arg_index++;

  if (arg_index === arg_count) {
    return format_arg;
  }

  // Walk over each formatting argument thing in the format string, and replace
  // it with one of the remaining arguments. We know there is at least one
  // other argument.
  const replaced_string =
      format_arg.replace(syntax_pattern, function replacer(match) {
        // If we've reached or moved past the end, then there are more
        // occurrences of formatting codes than arguments. Stop doing any
        // replacements.
        if (arg_index >= arg_count) {
          return match;
        }

        // Replace the matched formatting code with the current argument, and
        // advance the argument index to the next argument. The post-increment
        // occurs after the value is read
        switch (match) {
          case '%%':
            return '%';
          case '%s':
            return any_type_to_string_string(args[arg_index++]);
          case '%d':
            return any_type_to_number_string(args[arg_index++]);
          case '%o':
            return any_type_to_object_string(args[arg_index++]);
          default:
            return match;
        }
      });

  // Exit early if all arguments processed
  if (arg_index >= arg_count) {
    return replaced_string;
  }

  // There may be more arguments to the function than there are codes to
  // replace in the format string. Some of the arguments were used to do
  // replacements so far, but possibly not all of the arguments have been used.
  // Append the remaining unused arguments to a buffer, then join them.
  // This still works even if the above check was not present.
  const buffer = [replaced_string];
  while (arg_index < arg_count) {
    buffer.push(any_type_to_string_string(args[arg_index++]));
  }
  return buffer.join(' ');
}

function any_type_to_number_string(value) {
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
// not occur each time any_type_to_object_string is evaluated.
const native_has_own = Object.prototype.hasOwnProperty;

// Convert an object into a string. This does not assume the input is an object.
function any_type_to_object_string(value) {
  // typeof null === 'object', so special case for null. Cannot assume caller
  // already checked for this situation.
  if (value === null) {
    return 'null';
  }

  // NOTE: special case for undefined. Without this case, the call to
  // native_has_own.call below would throw an exception "TypeError: Cannot
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

  if (native_has_own.call(value, 'toString')) {
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
function any_type_to_string_string(value) {
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
      return any_type_to_number_string(value);
    case 'string':
      return value;
    case 'object':
      return any_type_to_object_string(value);
    default:
      return '' + value;
  }
}
