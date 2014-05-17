// Hash lib
(function(exports) {
  'use strict';
  
  function callback(previousValue, currentValue) {
    return (previousValue * 31 + currentValue.charCodeAt(0)) % 4294967296;
  }

  // Generate a simple hashcode from a character array
  function hashCode(arr) {
    if(arr && arr.length) {
       return arr.reduce(callback, 0);
    }
  }

  exports.hashCode = hashCode;
    
})(this);
