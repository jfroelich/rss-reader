import assert from '/src/lib/assert.js';

// Returns a new string where the publisher information has been stripped. For
// example, in the string "Florida man shoots self - Your Florida News", the
// algorithm would hopefully identify the publisher as "Your Florida news" and
// then return the string "Florida man shoots self" where the publisher has been
// filtered. |delimiters| is an optional array of delimiting characters that split
// the title between content and publisher. |minTitleLength| is a threshold
// below which any filtering is rejected.
export default function filterPublisher(title, delimiters, minTitleLength) {
  assert(typeof title === 'string');

  const defaultDelimiters = ['-', '|', ':'];
  if (!Array.isArray(delimiters)) {
    delimiters = defaultDelimiters;
  }

  const defaultMinTitleLength = 20;
  if (isNaN(minTitleLength)) {
    minTitleLength = defaultMinTitleLength;
  } else {
    assert(minTitleLength >= 0);
  }

  if (title.length < minTitleLength) {
    return title;
  }

  if (delimiters.length < 1) {
    return title;
  }

  const tokens = tokenizeWords(title);

  // Basically just assume there is no point to looking if we are only dealing
  // with 3 tokens or less. This is a tentative conclusion. Note that delimiters
  // are individual tokens here, and multiple consecutive delimiters will
  // constitute only one token. Note that this also implicitly handles the 0
  // tokens case.
  if (tokens.length < 4) {
    return title;
  }

  let delimiterIndex = -1;
  for (let i = tokens.length - 2; i > -1; i -= 1) {
    const token = tokens[i];
    if (delimiters.includes(token)) {
      delimiterIndex = i;
      break;
    }
  }

  if (delimiterIndex === -1) {
    return title;
  }

  // Regardless of the number of words in the full title, if the publisher we
  // find has too many words, the delimiter probably did not delimit the
  // publisher, so bail out.
  if (tokens.length - delimiterIndex - 1 > 5) {
    return title;
  }

  // If there are more publisher words than non-publisher words in the title,
  // then we should not filter out the publisher, because this indicates a
  // false positive identification of the delimiter, most of the time,
  // empirically.
  const nonPublisherWordCount = delimiterIndex;
  const publisherWordCount = tokens.length - delimiterIndex - 1;
  if (nonPublisherWordCount < publisherWordCount) {
    return title;
  }

  const nonPublisherTokens = tokens.slice(0, delimiterIndex);
  return nonPublisherTokens.join(' ');
}

// Split a string into smaller strings based on intermediate whitespace. Throws
// an error if string is not a String object. Returns an array.
function tokenizeWords(string) {
  // The implicit trim avoids producing empty tokens. The input might already
  // be trimmed but we cannot rely on that so we have to accept the overhead.
  return string.trim().split(/\s+/g);
}
