
var DEBUG_STATE = 1;

function DEBUG() {
  'use strict';
  if(DEBUG_STATE) {
    console.debug(...arguments);
  }
}
