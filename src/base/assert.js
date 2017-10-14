'use strict';

// NOTE: the problem is that I lose the file, line, col information and stack
// trace attached to the error. Without a message the error source is unclear.

// TODO: accept variable arity like console.log and format the string

function ASSERT(condition, message) {
  if(!condition)
    throw new Error(message || 'Assertion failed');
}
