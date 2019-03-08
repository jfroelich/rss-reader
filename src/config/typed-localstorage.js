// Provides type-specific i/o operations for storing configuration values, and
// serves an abstraction layer in case I change my mind regarding how values
// are stored.

export function rename(from, to) {
  const value = read_string(from);
  if (typeof value !== 'undefined') {
    write_string(to, value);
  }
  remove(from);
}

export function has_key(key) {
  return typeof localStorage[key] !== 'undefined';
}

export function read_array(key) {
  const value = localStorage[key];
  return value ? JSON.parse(value) : [];
}

export function remove(key) {
  delete localStorage[key];
}

export function remove_all(keys) {
  for (const key of keys) {
    remove(key);
  }
}

export function write_array(key, value) {
  localStorage[key] = JSON.stringify(value);
}

export function write_int(key, value) {
  localStorage[key] = '' + value;
}

export function read_int(key, fallback_value) {
  const string_value = localStorage[key];
  if (string_value) {
    const integer_value = parseInt(string_value, 10);
    if (!isNaN(integer_value)) {
      return integer_value;
    }
  }

  if (Number.isInteger(fallback_value)) {
    return fallback_value;
  }

  return NaN;
}

export function write_float(key, value) {
  localStorage[key] = value;
}

export function read_float(key) {
  return parseFloat(localStorage[key], 10);
}

export function write_boolean(key, value) {
  if (value) {
    write_int(key, 1);
  } else {
    remove(key);
  }
}

export function read_boolean(key) {
  return has_key(key);
}

export function write_string(key, value) {
  localStorage[key] = value;
}

export function read_string(key) {
  return localStorage[key];
}
