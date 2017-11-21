// A simple, slightly perverse, implementation of c's sprintf function, adapted for JavaScript.
// Much of the original implementation was inspired by node.js's utils.format function.
// Because strings are immutable, this cannot write to a string reference-pointer thing, so instead
// the output of the function is the string. So the name of the function is a bit misleading. The
// other major difference is that this operates more like console.log, and that this only supports
// a subset of the formatting syntax, and works a bit differently for certain expressions.

// Match occurrences of %s, %d, %o
const syntaxPattern = /%[sdo]/g;

// Returns a formatted string. Works kind of like console.arg
export default function sprintf(...args) {

  // args uses spread operator, so it will be defined even when there are no arguments. When there
  // are no arguments, args.length will be 0.

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
    return args.map(valueToString).join(' ');
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
    case '%s':  return valueToString(args[argIndex++]);
    case '%d':  return numberToString(args[argIndex++]);
    case '%o':  return objectToString(args[argIndex++]);
    default:    return match;
    }
  });

  if(argIndex >= argCount) {
    return replacedString;
  }

  // Append the remaining arguments as strings
  const buffer = [replacedString];
  for(; argIndex < argCount; argIndex++) {
    buffer.push(' ' + valueToString(args[argIndex]));
  }
  return buffer.join('');
}

function numberToString(number) {

  // NOTE: isNaN(null) is false, do not simply check isNaN

  if(number === null) {
    return 'NaN';
  } else if(number === void 0) {
    return 'NaN';
  } else if(isNaN(number)) {
    return 'NaN';
  } else {
    return '' + number;
  }
}



const nativeHasOwn = Object.prototype.hasOwnProperty;

// Convert an object into a string. This does not assume the input is an object.
function objectToString(object) {

  // typeof null === 'object', so special case for null. Cannot assume caller already checked
  // for this situation.
  if(object === null) {
    return 'null';
  }

  // NOTE: special case for undefined. Without this case, the call to nativeHasOwn.call below would
  // throw an exception "TypeError: Cannot convert undefined or null to object"
  // NOTE: undefined === void 0
  // NOTE: do not use void(0), void is an operator, not a function
  if(object === void 0) {
    return 'undefined';
  }

  // All objects subclass Object. And Object has a default toString implementation. So simply
  // checking object.toString is wrong, because that property lookup will eventually go up the
  // prototype chain and find Object.prototype.toString. Therefore, we want to test if the
  // object itself has a toString method defined using the hasOwnProperty method. But, we don't
  // want to use object.hasOwnProperty, because the object may have messed with it. So we use
  // the native hasOwnProperty call of the base Object object. Which also may have been messed
  // with but at that point it is overly-defensive.

  if(nativeHasOwn.call(object, 'toString')) {
    // The valueToString call is rather superfluous but it protects against custom objects or
    // manipulations of builtin objects that return the improper type.
    return valueToString(object.toString());
  }

  // NOTE: url.hasOwnProperty('toString') === false

  if(object instanceof URL) {
    return object.href;
  }

  try {
    return JSON.stringify(object);
  } catch(error) {
    return '{Object(Uncoercable)}';
  }
}

// Convert a value of an unknown type into a string
function valueToString(value) {
  if(value === null) {
    return 'null';
  }

  const type = typeof value;
  switch(type) {
  case 'undefined': return 'undefined';
  case 'number':    return numberToString(value);
  case 'string':    return value;
  case 'object':    return objectToString(value);
  default:          return '' + value;
  }
}
