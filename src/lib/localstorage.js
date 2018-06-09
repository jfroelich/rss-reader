export function localstorage_read_int(property_name) {
  const string_value = localStorage[property_name];
  if (string_value) {
    const integer_value = parseInt(string_value, 10);
    if (!isNaN(integer_value)) {
      return integer_value;
    }
  }
}

export function localstorage_read_array(key) {
  const value = localStorage[key];
  return value ? JSON.parse(string_value) : [];
}

export function localstroage_set_array(key, array) {
  localStorage[key] = JSON.stringify(array);
}

export function localstorage_read_float(property_name) {
  const string_value = localStorage[property_name];
  if (string_value) {
    const float_value = parseFloat(string_value, 10);
    if (!isNaN(float_value)) {
      return float_value;
    }
  }
}

// Values should generally be strings. If using a non-string, be wary of how
// it gets coerced to a string.
export function localstorage_set_if_undefined(key, value) {
  const old_value = localStorage[key];
  if (typeof old_value === 'undefined') {
    localStorage[key] = value;
  }
}
