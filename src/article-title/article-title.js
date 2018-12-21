import assert from '/src/assert.js';

export function filter_publisher(
    title, max_tail_words = 4, min_title_length = 20,
    min_publisher_length = 5) {

  // Tolerate partially bad input (Postel's Law)
  if (typeof title !== 'string') {
    return title;
  }

  const default_delims = ['-', '|', ':'];

  // Sanity check the delims param and possibly assign a default value to it
  if(Array.isArray(delims)) {
    if(delims.length < 1) {
      // Technically the function should never be called with an empty array of
      // delimiters because the function will never find a publisher in that
      // case. However, partially tolerate bad input (Postel's Law) for caller
      // convenience rather than throw an error. Note this fails to bring the
      // problem to the caller's attention though.
      // TODO: maybe nag with a console warning?
      return title;
    } else {
      // Leave delims as is
    }
  } else if(delims === null || delims === undefined) {
    delims = default_delims;
  } else {
    // Should never enter this branch
    assert(false);
  }

  const NOT_FOUND = -1;
  let delim_pos = NOT_FOUND;
  for(let i = 0, len = delims.length; i < len && delim_pos === NOT_FOUND; i++) {
    delim_pos = title.lastIndexOf(' ' + delims[i] + ' ');
  }

  if (delim_pos === NOT_FOUND) {
    return title;
  }

  if (delim_pos < min_title_length) {
    return title;
  }

  const remaining = title.length - delim_pos;
  if (remaining < min_publisher_length) {
    return title;
  }

  // The 3 length accounts for leading and trailing whitespace
  const delim_len = 3;
  const tail = title.substring(delim_pos + delim_len);
  if (count_words(tail) > max_tail_words) {
    return title;
  }

  return title.substring(0, delim_pos).trim();
}

export function count_words(value) {
  return tokenize(value).length;
}

// Split a string into smaller strings based on intermediate whitespace
export function tokenize(value) {
  if (typeof value === 'string') {
    // Avoid empty tokens
    const trimmed = value.trim();
    if (trimmed.length) {
      return trimmed.split(/\s+/g);
    }
  }
  return [];
}
