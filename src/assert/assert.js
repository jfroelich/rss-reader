
// NOTE: the problem is that I lose the file, line, col information and stack
// trace attached to the error. Without a message the error source is unclear.

function assert(condition, message) {
  'use strict';
  if(!condition)
    throw new Error(message || 'Assertion failed');
}
