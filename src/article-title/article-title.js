import assert from '/src/assert.js';

export function filter_publisher(title, options = {}) {
  let delims = options.delims;
  let max_tail_words = options.max_tail_words;
  let min_title_length = options.min_title_length;
  let min_publisher_length = options.min_publisher_length;

  // Tolerate partially bad input (Postel's Law)
  if (typeof title !== 'string') {
    return title;
  }

  if(title.length < min_title_length) {
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

  const tokens = tokenize(title);

  // Basically just assume there is no point to looking if we are only dealing
  // with 3 tokens or less. This is a tentative conclusion. Note that delimiters
  // are individual tokens here, and multiple consecutive delimiters will
  // constitute only one token.
  if(tokens.length < 4) {
    return title;
  }

  // TODO: this could probably be smarter, this is just first draft
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

  // Ignore publisher unless remaining title is larger
  if(delimiter_index < tokens.length - delimiter_index - 1) {
    return title;
  }

  const non_pub_tokens = tokens.slice(0, delimiter_index);
  return non_pub_tokens.join(' ');
}

// Split a string into smaller strings based on intermediate whitespace
export function tokenize(value) {
  if (typeof value === 'string' && value.length) {
    // Avoid empty tokens
    const trimmed = value.trim();
    if (trimmed.length) {
      return trimmed.split(/\s+/g);
    }
  }
  return [];
}
