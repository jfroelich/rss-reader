'use strict';

// import base/string.js

function articleTitleFilterPublisher(title) {
  console.assert(typeof title === 'string');

  // TODO: tolerate alternate whitespace expressions

  // Look for a delimiter
  let index = title.lastIndexOf(' - ');

  if(index < 0) {
    index = title.lastIndexOf(' | ');
  }

  if(index < 0) {
    index = title.lastIndexOf(' : ');
  }

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
  const remainingCharCount = title.length - index;
  if(remainingCharCount < MIN_PUBLISHER_NAME_LENGTH) {
    return title;
  }

  const delimiterLength = 3;
  const tail = title.substring(index + delimiterLength);
  const words = string_tokenize(tail);

  const MAX_TAIL_WORDS = 4;
  if(words.length > MAX_TAIL_WORDS) {
    return title;
  }

  let outputTitle = title.substring(0, index);
  return outputTitle.trim();
}
