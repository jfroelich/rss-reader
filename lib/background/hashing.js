
var hashing = {};

// Generate a simple hashcode from a character array
hashing.hashCode = function(arr) {
  if(arr && arr.length) {
    return arr.reduce(this.reducer_, 0);
  } 
};

// Private helper for hashCode
hashing.reducer_ = function (previousValue, currentValue) {
  return (previousValue * 31 + currentValue.charCodeAt(0)) % 4294967296;
};