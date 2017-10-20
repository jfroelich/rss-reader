'use strict';

// import base/assert.js
// import base/string.js

function article_title_filter_publisher(title) {
  ASSERT(typeof title === 'string');

  // Look for a delimiter
  let index = title.lastIndexOf(' - ');
  if(index < 0)
    index = title.lastIndexOf(' | ');
  if(index < 0)
    index = title.lastIndexOf(' : ');

  // Exit early if no delimiter found
  if(index < 0) {
    return title;
  }

  // Exit early if the delimiter did not occur late enough in the title
  const MIN_TITLE_LENGTH = 20;
  if(index < MIN_TITLE_LENGTH) {
    return title;
  }

  // Exit early if the delimiter was found too close to the end of the string
  const MIN_PUBLISHER_NAME_LENGTH = 5;
  const remaining_char_count = title.length - index;
  if(remaining_char_count < MIN_PUBLISHER_NAME_LENGTH) {
    return title;
  }

  const tail = title.substring(index + 3);

  const words = string_tokenize(tail);

  // Too many words in the tail
  if(words.length > 4) {
    return title;
  }

  let output_title = title.substring(0, index);
  output_title = output_title.trim();
  return output_title;
}
