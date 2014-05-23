
// This library is similar to Underscore. Considering 
// deprecating it and switching to Underscore.

var collections = {};

// forEach for array-like objects
collections.each = function(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0; i < len; 
    func(obj[i++])) {
  }
};

// Iterate over obj until func does not yield a truthful value
collections.until = function(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0, continues = 1; 
    continues && i < len; continues = func(obj[i++])) {
  }
};

// Returns truthy if func returns true for any item in obj
// Iterates in reverse, stops once func returns true.
collections.any = function(obj, func) {
  for(var i = obj ? obj.length : 0; i--;) {
    if(func(obj[i]))
      return 1;
  }
};

// Adapted from http://stackoverflow.com/questions/11190407
// TODO: consider using the apply method

// Finds the highest number in an array of unsigned longs
collections.arrayMax = function(arr) {
  
  // Check arr.length in order to not return -Infinity 
  // for empty arrays
  
  // We use -Infinity as the lowest value, not 0, because
  // we could be working with negative values and 0 is 
  // higher than negative values.
  
  // Number.NEGATIVE_INFINITY == -Infinity
  
  if(arr && arr.length) {
    return arr.reduce(this.wrapMax_, -Infinity);
  }
};

// Private helper for arrayMax. It is necessary to wrap it because
// passing Math.max itself to reduce does not work.
collections.wrapMax_ = function(previousValue, currentValue) {
  return Math.max(previousValue, currentValue); 
};