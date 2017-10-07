
// Global use strict requires for spread args operator
'use strict';

const DEBUG_STATE = true;

// This uses the ES6 spread operator to avoid touching the arguments object
function DEBUG(...args) {
  if(DEBUG_STATE)
    console.debug(...args);
}
