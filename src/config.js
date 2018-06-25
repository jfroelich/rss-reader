// App settings access layer

export function remove(key) {
  delete localStorage[key];
}

export function remove_all(keys) {
  for (const key of keys) {
    remove(key);
  }
}

export function has_key(key) {
  // We don't care about value, cannot use simple truthy test
  return typeof localStorage[key] !== 'undefined';
}

export function write_array(key, value) {
  localStorage[key] = JSON.stringify(value);
}

export function read_array(key) {
  const value = localStorage[key];
  return value ? JSON.parse(value) : [];
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
  localStorage[key] = '' + value;
}

export function read_float(key) {
  const string_value = localStorage[key];
  if (string_value) {
    const float_value = parseFloat(string_value, 10);
    if (!isNaN(float_value)) {
      return float_value;
    }
  }
  return NaN;
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

// These descriptors represent hosts that should be excluded when fetching new
// articles. This is a hackish solution that serves to provide the feature for
// now until I think more about how to serialize this.
// TODO: should be storing descriptions in localStorage, need to look into using
// Regex constructor and learn how to use it

const inaccessible_content_descriptors = [
  {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
  {pattern: /productforums\.google\.com$/i, reason: 'script-generated'},
  {pattern: /groups\.google\.com$/i, reason: 'script-generated'},
  {pattern: /nytimes\.com$/i, reason: 'paywall'},
  {pattern: /wsj\.com$/i, reason: 'paywall'},
  {pattern: /heraldsun\.com\.au$/i, reason: 'requires-cookies'},
  {pattern: /ripe\.net$/i, reason: 'requires-cookies'},
  {pattern: /foxnews.com$/i, reason: 'fake'}
];

export function get_inaccessible_content_descriptors() {
  return inaccessible_content_descriptors;
}
