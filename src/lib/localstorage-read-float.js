// TODO: create lib localstorage.js, merge this into there along with read-int
export function localstorage_read_float(property_name) {
  const string_value = localStorage[property_name];
  if (string_value) {
    const float_value = parseFloat(string_value, 10);
    if (!isNaN(float_value)) {
      return float_value;
    }
  }
}
