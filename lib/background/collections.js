// Collection utilities
(function(exports) {
'use strict';

// This library is similar to Underscore.

// forEach for array-like objects and arrays
exports.each = function(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0; i < len; 
    func(obj[i++])) {
  }
};

// Iterate over obj until func does not yield a truthful value
exports.until = function(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0, continues = 1; 
    continues && i < len; continues = func(obj[i++])) {
  }
};

// Returns truthy if f returns true for any item in o
// Iterates in reverse, stops once f returns true.
exports.any = function(o, f) {
  for(var i = o ? o.length : 0; i--;) {
    if(f(o[i]))
      return 1;
  }
};

// Adapted from http://stackoverflow.com/questions/11190407
exports.arrayMax = function(arr) {
  if(arr && arr.length) {
    return arr.reduce(function(p,c) {
      return Math.max(p,c); 
    }, Number.NEGATIVE_INFINITY);
  }
};

}(this));