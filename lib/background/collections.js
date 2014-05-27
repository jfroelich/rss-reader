
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

// Returns an array of an objects own values.
collections.values = function(obj) {
  // For starters lets just make sure it works then try to use some 
  // more native existing method in the future.
  
  // http://stackoverflow.com/questions/3865139/cast-javascript-object-to-array-how-to
  
  
  // The code below does not include the length property
  // Using hasOwnProperty avoids potential conflicts 
  // (e.g. if using Prototype.js or something similar)
  
  // for..in is out of order iteration, which is perfectly fine here
  // as that is how I would expect hash key iteration to work

  // I know there is Object.keys, but is there Object.values or somethign
  // to that effect?

  //var hasOwnProperty = Object.prototype.hasOwnProperty;
  var arr = [];
  //for(var key in obj) {
  //  if(hasOwnProperty.call(obj, key)) {
  //    arr.push(obj[key]);
  //  }
  //}
  Object.getOwnPropertyNames(obj).forEach(function(key) {
    arr.push(obj[key]);
  });

  return arr;
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