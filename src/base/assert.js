// Assertion library

'use strict';

// Dependencies:
// none


// NOTE: the problem is that I lose the file, line, col information and stack
// trace attached to the error. Without a message the error source is unclear.
// Actually it is not that bad, it is 1 step down the stack.

// TODO: accept variable arity like console.log and format the parameters
// after the condition parameter. This requires some implemention of
// printf, but it should work more like console.log
// NOTE: it is possible to do function(param1, ...otherargs)

function ASSERT(condition, message) {
  if(!condition) {
    throw new Error(message || 'Assertion failed');
  }
}
