// TODO: review handling of html entities
// TODO: support other whitespace than space around delims

// The nlp module provides various text processing utilities

// Returns a new string where the publisher information has been stripped, such
// as the string "Your Florida news" in the string "Florida man shoots self -
// Your Florida News". The algorithm identifies the publisher by looking for a
// delimiter and comparing the word count before and after it. If there is any
// problem, then the original title is returned.
//
// @param title {String}
// @param delims {Array} array of strings, delimiters (currently including
// spaces between the delimiter and other words)
// @param max_tail_words - if there are too many words after the delimiter then
// publisher is not filtered
// @param min_title_length - if the title has too few characters before or after
// filtering then publisher is not filtered
// @param min_publisher_length - if the publisher has too few characters then
// the publisher is not filtered
export function filter_publisher(
    title, delims = ['-', '|', ':'], max_tail_words = 4, min_title_length = 20,
    min_publisher_length = 5) {
  // Tolerate bad input (Postel's Law)
  if (typeof title !== 'string') {
    return title;
  }

  let delim_pos = -1;
  for (const delim of delims) {
    delim_pos = title.lastIndexOf(' ' + delim + ' ');
    if (delim_pos > -1) {
      break;
    }
  }

  if (delim_pos < 0) {
    return title;
  }

  if (delim_pos < min_title_length) {
    return title;
  }

  const remaining = title.length - delim_pos;
  if (remaining < min_publisher_length) {
    return title;
  }

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
