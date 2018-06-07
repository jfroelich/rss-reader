// The `filter_publisher` function provides a way to strip publisher information
// from an article title. The input title variable is a `DOMString` and an
// optional options object. The function returns a new string where the
// publisher information has been stripped.

// The function basically works by looking for typical delimiters found in
// document titles, such as the dash character found in &quot;Florida man shoots
// self - Your Florida News&quot;.

// If there is any problem, then the original title is returned. For example,
// the function received bad input. Or the function was not confident about
// whether it found a publisher substring and decided not to remove it.

// ### Options
// * **max_tail_words** - the maximum number of words following delimiter, if
// the number of words following the delimiter is greater than this number then
// the publisher is considered too long and therefore unlikely a publisher and
// therefore is not filtered
// * **min_title_length** - the minimum number of characters in a title, if the
// title is too short before or after filtering the publisher then the publisher
// is not filtered
// * **min_publisher_length** - minimum number of characters in publisher name,
// including spaces, if the publisher is too short then the publisher is not
// filtered
// * **delims** - array of strings, delimiters (currently including spaces
// between the delimiter and other words)

// If any option is not set, a default value is used. Options are not validated
const DEFAULT_OPTIONS = {
  max_tail_words: 4,
  min_title_length: 20,
  min_publisher_length: 5,
  delims: [' - ', ' | ', ' : ']
};

export function filter_publisher(title, input_options = {}) {
  if (typeof title !== 'string') {
    return title;
  }

  const options = Object.assign({}, DEFAULT_OPTIONS, input_options);

  let delim_pos = -1;
  for (const delim of options.delims) {
    delim_pos = title.lastIndexOf(delim);
    if (delim_pos > -1) {
      break;
    }
  }

  if (delim_pos < 0) {
    return title;
  }

  if (delim_pos < options.min_title_length) {
    return title;
  }

  const remaining = title.length - delim_pos;
  if (remaining < options.min_publisher_length) {
    return title;
  }

  const delim_len = 3;
  const tail = title.substring(delim_pos + delim_len);
  if (count_words(tail) > options.max_tail_words) {
    return title;
  }

  return title.substring(0, delim_pos).trim();
}

function count_words(value) {
  return tokenize(value).length;
}

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
