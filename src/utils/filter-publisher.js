import assert from "/src/assert/assert.js";
import tokenize from "/src/utils/tokenize.js";

// Filter publisher information from an article title
// TODO: support alternate whitespace expressions around delimiters
// @param title {String} the title of an web page
// @returns {String} the title without publisher information
export default function filterPublisher(title) {
  assert(typeof title === 'string');

  // Look for a delimiter
  let delimiterPosition = title.lastIndexOf(' - ');
  if(delimiterPosition < 0) {
    delimiterPosition = title.lastIndexOf(' | ');
  }
  if(delimiterPosition < 0) {
    delimiterPosition = title.lastIndexOf(' : ');
  }

  // Exit early if no delimiter found
  if(delimiterPosition < 0) {
    return title;
  }

  // Exit early if the delimiter did not occur late enough in the title
  const MIN_TITLE_LENGTH = 20;
  if(delimiterPosition < MIN_TITLE_LENGTH) {
    return title;
  }

  // Exit early if the delimiter was found too close to the end
  const MIN_PUBLISHER_NAME_LENGTH = 5;
  const remainingCharCount = title.length - delimiterPosition;
  if(remainingCharCount < MIN_PUBLISHER_NAME_LENGTH) {
    return title;
  }

  // Break apart the tail into words
  const delimiterLength = 3;
  const tail = title.substring(delimiterPosition + delimiterLength);
  const words = tokenize(tail);

  // If there are too many words, return the full title, because tail is probably not a publisher
  const MAX_TAIL_WORDS = 4;
  if(words.length > MAX_TAIL_WORDS) {
    return title;
  }

  // Return the modified title
  let outputTitle = title.substring(0, delimiterPosition);
  return outputTitle.trim();
}
