'use strict';

// TODO: accept variable arity like console.log and format the parameters
// after the condition parameter. This requires some implemention of
// printf, but it should work more like console.log
// it is possible to do function(param1, ...varargs)

function ASSERT(condition, message) {
  if(!condition) {
    throw new Error(message || 'Assertion failed');
  }
}
