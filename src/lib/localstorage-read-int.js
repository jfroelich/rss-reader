export function localstorage_read_int(property_name) {
  const string_value = localStorage[property_name];
  if (string_value) {
    const integer_value = parseInt(string_value, 10);
    if (!isNaN(integer_value)) {
      return integer_value;
    }
  }
}
