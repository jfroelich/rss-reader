// Generate a simple hashcode from a character array
function generateHashCode(arr) {
  if(arr && arr.length) {
    return arr.reduce(function (previousValue, currentValue) {
      return (previousValue * 31 + currentValue.charCodeAt(0)) % 4294967296;
    }, 0);
  }
}