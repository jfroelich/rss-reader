'use strict';

function ASSERT(condition, message) {
  if(!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function ASSERT_NOT_REACHED() {
  ASSERT(false, 'not reached');
}
