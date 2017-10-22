'use strict';

const DEBUG_IS_ENABLED = true;

// This uses the ES6 spread operator to avoid touching the arguments object
// Using the spread operator in parameters requires strict mode
// TODO: i really do not love how this is masking __FILE__ and __LINE__
function DEBUG(...args) {
  if(DEBUG_IS_ENABLED) {
    console.debug(...args);
  }
}
