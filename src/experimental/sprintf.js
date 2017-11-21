// A simple, slightly perverse, implementation of the sprintf function, adapted for JavaScript.
// Much of this implementation was inspired by node.js's utils.format function.
// Because strings are immutable, this cannot write to a string reference-pointer thing, so instead
// the output of the function is the string. So the name of the function is a bit misleading. The
// other major difference is that this operates more like console.log, and that this only supports
// a subset of the formatting syntax.

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

  // Handle the simple no arguments case. Note this returns undefined in this case, not a string.
  if(argCount === 0) {
    return;
  }

  // Track where we are in interating over arguments
  let argIndex = 0;

  // The first argument is the formatArg
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
    case '%s':
      return '' + args[argIndex++];
    case '%d':
      return Number(args[argIndex++]);
    case '%o':
      try {
        return JSON.stringify(args[argIndex++]);
      } catch(error) {
        return '{Object(Uncoercable)}';
      }
    default:
      return match;
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


function valueToString(value) {

  if(value === null) {
    return 'null';
  }

  const type = typeof value;
  switch(type) {
  case 'undefined':
    return 'undefined';
  case 'number':
    return '' + value;
  case 'string':
    return value;
  case 'object':
    try {
      return JSON.stringify(value);
    } catch(error) {
      return '{Object(Uncoercable)}';
    }
  default:
    return '' + value;
  }
}
