import assert from '/src/assert.js';

export function filter_publisher(title, delims, min_title_length) {
  assert(typeof title === 'string');

  const default_delims = ['-', '|', ':'];

  // TODO: maybe this should be a stricter sanity check. |delims| should be
  // either null, undefined, or an array. Anything else should be a type error.
  if(!Array.isArray(delims)) {
    delims = default_delims;
  }

  const default_min_title_length = 20;

  // TODO: like above, perhaps this should only allow null, undefined, and
  // positive integer, and anything else should be an error, not a substitution
  if(isNaN(min_title_length)) {
    min_title_length = default_min_title_length;
  } else {
    assert(min_title_length >= 0);
  }

  if(title.length < min_title_length) {
    return title;
  }

  if(delims.length < 1) {
    return title;
  }

  const tokens = tokenize_words(title);

  // Basically just assume there is no point to looking if we are only dealing
  // with 3 tokens or less. This is a tentative conclusion. Note that delimiters
  // are individual tokens here, and multiple consecutive delimiters will
  // constitute only one token. Note that this also implicitly handles the 0
  // tokens case.
  if(tokens.length < 4) {
    return title;
  }

  // TODO: this could be smarter, this is just first draft, well, it
  // is now like the 6th revision of this module, but this is the first attempt
  // at using the index of tokens instead of input string length
  // TODO: use a loop with only one exit condition
  // TODO: if i is defined outside of the loop's scope, then we can just move
  // i along like a cursor, and the loop's exit condition leaves i at some
  // point

  let delimiter_index = -1;
  for(let i = tokens.length - 2; i > -1; i--) {
    const token = tokens[i];
    if(delims.includes(token)) {
      delimiter_index = i;
      break;
    }
  }

  if(delimiter_index === -1) {
    return title;
  }

  // Regardless of the number of words in the full title, if the publisher we
  // find has too many words, the delimiter probably did not delimit the
  // publisher, so bail out.
  // TODO: this rule can be implicit in the above loop by limiting the number
  // of iterations before exiting.
  // TODO: the number of words in the publisher is a metric that is used again
  // later in this function, so maybe it makes more sense to store it in a
  // variable to avoid the cost of recalculation and to use named values instead
  // of expressions.
  if(tokens.length - delimiter_index - 1 > 5) {
    return title;
  }

  // If there are more publisher words than non-publisher words in the title,
  // then we should not filter out the publisher, because this indicates a
  // false positive identification of the delimiter, most of the time,
  // empirically.
  // TODO: i am not satisfied with the clarity here, there is anxiety about
  // off by 1 error
  // TODO: what is more accurate? character count or word count
  // TODO: is it simpler and safer to count pub words by subtracting non pub
  // words from total? again, off by 1 anxiety.

  const non_pub_word_count = delimiter_index;
  const pub_word_count = tokens.length - delimiter_index - 1;
  if(non_pub_word_count < pub_word_count) {
    return title;
  }

  const non_pub_tokens = tokens.slice(0, delimiter_index);
  return non_pub_tokens.join(' ');
}

// Split a string into smaller strings based on intermediate whitespace. Throws
// an error if string is not a String object. Returns an array.
export function tokenize_words(string) {
  // The implicit trim avoids producing empty tokens. The input might already
  // be trimmed but we cannot rely on that so we have to accept the overhead.
  return string.trim().split(/\s+/g);
}
