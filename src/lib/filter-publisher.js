import {assert} from '/src/lib/assert.js';

// Returns a new string where the publisher information has been stripped. For
// example, in the string "Florida man shoots self - Your Florida News", the
// algorithm would hopefully identify the publisher as "Your Florida news" and
// then return the string "Florida man shoots self" where the publisher has been
// filtered. |delims| is an optional array of delimiting characters that split
// the title between content and publisher. |min_title_length| is a threshold
// below which any filtering is rejected.
export function filter_publisher(title, delims, min_title_length) {
  assert(typeof title === 'string');

  const default_delims = ['-', '|', ':'];
  if (!Array.isArray(delims)) {
    delims = default_delims;
  }

  const default_min_title_length = 20;
  if (isNaN(min_title_length)) {
    min_title_length = default_min_title_length;
  } else {
    assert(min_title_length >= 0);
  }

  if (title.length < min_title_length) {
    return title;
  }

  if (delims.length < 1) {
    return title;
  }

  const tokens = tokenize_words(title);

  // Basically just assume there is no point to looking if we are only dealing
  // with 3 tokens or less. This is a tentative conclusion. Note that delimiters
  // are individual tokens here, and multiple consecutive delimiters will
  // constitute only one token. Note that this also implicitly handles the 0
  // tokens case.
  if (tokens.length < 4) {
    return title;
  }

  let delimiter_index = -1;
  for (let i = tokens.length - 2; i > -1; i--) {
    const token = tokens[i];
    if (delims.includes(token)) {
      delimiter_index = i;
      break;
    }
  }

  if (delimiter_index === -1) {
    return title;
  }

  // Regardless of the number of words in the full title, if the publisher we
  // find has too many words, the delimiter probably did not delimit the
  // publisher, so bail out.
  if (tokens.length - delimiter_index - 1 > 5) {
    return title;
  }

  // If there are more publisher words than non-publisher words in the title,
  // then we should not filter out the publisher, because this indicates a
  // false positive identification of the delimiter, most of the time,
  // empirically.
  const non_pub_word_count = delimiter_index;
  const pub_word_count = tokens.length - delimiter_index - 1;
  if (non_pub_word_count < pub_word_count) {
    return title;
  }

  const non_pub_tokens = tokens.slice(0, delimiter_index);
  return non_pub_tokens.join(' ');
}

// Split a string into smaller strings based on intermediate whitespace. Throws
// an error if string is not a String object. Returns an array.
function tokenize_words(string) {
  // The implicit trim avoids producing empty tokens. The input might already
  // be trimmed but we cannot rely on that so we have to accept the overhead.
  return string.trim().split(/\s+/g);
}
