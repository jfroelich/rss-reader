// Debugging utilities

'use strict';

const DEBUG_STATE = true;

// This uses the ES6 spread operator to avoid touching the arguments object
// Using the spread operator in parameters requires strict mode
function DEBUG(...args) {
  if(DEBUG_STATE) {
    console.debug(...args);
  }
}
