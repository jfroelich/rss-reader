

// No operation 'singleton'
function noop() {
}

// Gets the values of the properties of an array-like object
// TODO: this is a good use case to learn about partials
function objectValues(obj) {
  return Object.keys(obj).filter(function(key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }).map(function(key) {
    return obj[key];
  });
}