// Returns a new object that is a copy of the input less empty properties. A property is empty if it
// is null, undefined, or an empty string. Ignores prototype, deep objects, getters, etc. Shallow
// copy by reference.
export default function filterEmptyProps(object) {
  const hasOwnProp = Object.prototype.hasOwnProperty;
  const output = {};
  let undef;

  if(typeof object === 'object') {
    for(const key in object) {
      if(hasOwnProp.call(object, key)) {
        const value = object[key];
        if(value !== undef && value !== null && value !== '') {
          output[key] = value;
        }
      }
    }
  }

  return output;
}
