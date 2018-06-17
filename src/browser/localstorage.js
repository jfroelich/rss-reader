export function read_array(key) {
  const value = localStorage[key];
  return value ? JSON.parse(value) : [];
}

export function read_int(property_name) {
  const string_value = localStorage[property_name];
  if (string_value) {
    const integer_value = parseInt(string_value, 10);
    if (!isNaN(integer_value)) {
      return integer_value;
    }
  }
  return NaN;
}

export function read_float(property_name) {
  const string_value = localStorage[property_name];
  if (string_value) {
    const float_value = parseFloat(string_value, 10);
    if (!isNaN(float_value)) {
      return float_value;
    }
  }
  return NaN;
}

// If value is not a string, it is coerced to a string
export function set_if_undef(key, value) {
  const old_value = localStorage[key];
  if (typeof old_value === 'undefined') {
    localStorage[key] = value;
  }
}
