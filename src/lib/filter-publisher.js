// TODO: review handling of html entities
// TODO: revise as a method of a more general nlp module
// TODO: support other whitespace than space around delims

// Returns a new string where the publisher information has been stripped, such
// as the string "Your Florida news" in the string "Florida man shoots self -
// Your Florida News". The algorithm identifies the publisher by looking for a
// delimiter and comparing the word count before and after it. If there is any
// problem, then the original title is returned.
//
// @param title {String}
// @param delims {Array} array of strings, delimiters (currently including
// spaces between the delimiter and other words)
// @param max_tail_words - the maximum number of words following delimiter, if
// the number of words following the delimiter is greater than this number then
// the publisher is considered too long and therefore unlikely a publisher and
// therefore is not filtered
// @param min_title_length - the minimum number of characters in a title, if the
// title is too short before or after filtering the publisher then the publisher
// is not filtered
// @param min_publisher_length - minimum number of characters in publisher name,
// including spaces, if the publisher is too short then the publisher is not
// filtered
export function filter_publisher(
    title, delims = ['-', '|', ':'], max_tail_words = 4, min_title_length = 20,
    min_publisher_length = 5) {
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

function count_words(value) {
  return tokenize(value).length;
}

// Split a string into smaller strings based on intermediate whitespace
function tokenize(value) {
  if (typeof value === 'string') {
    // Avoid empty tokens
    const trimmed = value.trim();
    if (trimmed.length) {
      return trimmed.split(/\s+/g);
    }
  }
  return [];
}
