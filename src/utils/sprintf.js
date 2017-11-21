// A simple, slightly perverse, implementation of c's sprintf function, adapted for JavaScript.
// Much of the original implementation was inspired by node.js's utils.format function.
// Because strings are immutable, this cannot write to a string reference-pointer thing, so instead
// the output of the function is the string. So the name of the function is a bit misleading. The
// other major difference is that this operates more like console.log, and that this only supports
// a subset of the formatting syntax, and works a bit differently for certain expressions.

// TODO: should syntaxPattern be case-insensitive? Test if %O works in console, or means something
// entirely different

// %s - string
// %d - number
// %o - object
// %% - literal '%'
const syntaxPattern = /%[sdo%]/g;

export default function sprintf(...args) {

  // To avoid touching the implicit 'arguments' variable, this uses the spread operator.
  // Why avoid using arguments? Because:
  // https://github.com/petkaantonov/bluebird/wiki/Optimization-killers

  // args uses spread operator, so it will be defined even when there are no arguments. When there
  // are no arguments, args.length will be 0.

  // We cannot rely on assert.js because assert.js relies on this. Also, we don't want to raise
  // an error within assert. Therefore, use the builtin weak assert to test the assumption that
  // a spread argument is always defined, to clarify why calling args.length would fail.
  console.assert(args);

  // Cache the number of args. It will not change for the rest of this function. Internally it is
  // implemented as a 'getter' function, so it is faster to cache than re-evaluate the getter each
  // time.
  const argCount = args.length;

  // Handle the simple no arguments case
  // TODO: would it be more appropriate to return undefined in this case?
  if(argCount === 0) {
    return '';
  }

  // Track where we are in interating over arguments
  let argIndex = 0;

  const formatArg = args[argIndex];

  // If the first argument isn't a string, then just group the arguments together as a string
  // that is space separated and return.
  if(typeof formatArg !== 'string') {
    return args.map(anyTypeToStringString).join(' ');
  }

  // Advance to the first argument after the formatArg
  argIndex++;

  // If there was only 1 argument, it is the formatArg, just return it as is
  if(argIndex === argCount) {
    return formatArg;
  }

  const replacedString = formatArg.replace(syntaxPattern, function replacer(match) {
    // If we've reached or moved past the end, then there are more occurrences of
    // %s things than arguments, just return the thing as is
    if(argIndex >= argCount) {
      return match;
    }

    // Replace the thing with the argument, and advance the index
    // The post-increment write occurs after the value is read
    switch(match) {
    case '%%':  return '%';
    case '%s':  return anyTypeToStringString(args[argIndex++]);
    case '%d':  return anyTypeToNumberString(args[argIndex++]);
    case '%o':  return anyTypeToObjectString(args[argIndex++]);
    default:    return match;
    }
  });

  if(argIndex >= argCount) {
    return replacedString;
  }

  // There may be more arguments to the function than there are things to replace in the format
  // string. Some of the arguments were used to do replacements so far, but possibly not all of the
  // arguments have been used. Append the remaining unused arguments as strings to a buffer of
  // strings, then join the strings together using a space delimiter and return the joined string.
  // If there were not enough arguments to even do replacements, the loop is skipped, in which case
  // the buffer is just the replacedString itself, in which case join knows to avoid adding a
  // delimiter when its array length is less than 2.
  const buffer = [replacedString];
  while(argIndex < argCount) {
    buffer.push(anyTypeToStringString(args[argIndex++]));
  }
  return buffer.join(' ');
}

function anyTypeToNumberString(value) {
  if(typeof value === 'number') {
    if(Object.is(value, -0)) {
      // Special case for negative zero because otherwise ('' + -0) yields '0'.
      // This matches console.log behavior.
      return '-0';
    } else {
      // Convert the number to a string. I've chosen this syntax because apparently it is faster
      // than calling the String constructor (either as a function or a constructor function).
      return '' + value;
    }
  } else {
    return 'NaN';
  }
}

// Cache the reference to the native function so that the property lookup does not occur each
// time anyTypeToObjectString is evaluated.
const nativeHasOwn = Object.prototype.hasOwnProperty;

// Convert an object into a string. This does not assume the input is an object.
function anyTypeToObjectString(value) {

  // typeof null === 'object', so special case for null. Cannot assume caller already checked
  // for this situation.
  if(value === null) {
    return 'null';
  }

  // NOTE: special case for undefined. Without this case, the call to nativeHasOwn.call below would
  // throw an exception "TypeError: Cannot convert undefined or null to object"
  // NOTE: undefined === void 0
  // NOTE: do not use void(0), void is an operator, not a function
  if(value === void 0) {
    return 'undefined';
  }

  // Do not delegate to JSON.stringify because that wraps string in quotes
  if(typeof value === 'string') {
    return value;
  }

  // Handle date specifically, do not delegate to JSON.stringify
  if(value instanceof Date) {
    return value.toString();
  }

  // All objects subclass Object. And Object has a default toString implementation. So simply
  // checking value.toString is wrong, because that property lookup will eventually go up the
  // prototype chain and find Object.prototype.toString. Therefore, we want to test if the
  // object itself has a toString method defined using the hasOwnProperty method. But, we don't
  // want to use value.hasOwnProperty, because the value may have messed with it. So we use
  // the native hasOwnProperty call of the base Object object. Which also may have been messed
  // with but at that point it is overly-defensive.

  if(nativeHasOwn.call(value, 'toString')) {
    // The anyTypeToStringString call is rather superfluous but it protects against custom objects
    // or manipulations of builtin objects that return the improper type.
    // TODO: I'd rather this not be recursive-like, functions should not call each other
    return anyTypeToStringString(value.toString());
  }

  // NOTE: url.hasOwnProperty('toString') === false
  // NOTE: href is canonicalized, e.g. "p://a.b" becomes "p://a.b/" (trailing slash)
  if(value instanceof URL) {
    return value.href;
  }

  if(typeof value === 'function') {
    return value.toString();
  }

  try {
    return JSON.stringify(value);
  } catch(error) {
    return '{Object(Uncoercable)}';
  }
}

function functionToString(f) {
  return f.toString();
}

// Convert a value of an unknown type into a string
function anyTypeToStringString(value) {
  if(value === null) {
    return 'null';
  }

  const type = typeof value;
  switch(type) {
  case 'undefined': return 'undefined';
  case 'function':  return functionToString(value);
  case 'number':    return anyTypeToNumberString(value);
  case 'string':    return value;
  case 'object':    return anyTypeToObjectString(value);
  default:          return '' + value;
  }
}
