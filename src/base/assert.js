'use strict';

const ASSERT_ASSERTIONS_ENABLED = true;

function ASSERT(condition, message) {
  if(ASSERT_ASSERTIONS_ENABLED) {
    if(!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }
}

function ASSERT_NOT_REACHED() {
  ASSERT(false, 'not reached');
}
