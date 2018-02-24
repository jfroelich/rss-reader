export function filter_title_publisher(title) {
  if (typeof title !== 'string') {
    console.error('Invalid title parameter', title);
    return title;
  }

  // Look for a delimiter
  let delimiter_position = title.lastIndexOf(' - ');
  if (delimiter_position < 0) {
    delimiter_position = title.lastIndexOf(' | ');
  }
  if (delimiter_position < 0) {
    delimiter_position = title.lastIndexOf(' : ');
  }

  // Exit early if no delimiter found
  if (delimiter_position < 0) {
    return title;
  }

  // Exit early if the delimiter did not occur late enough in the title
  const MIN_TITLE_LENGTH = 20;
  if (delimiter_position < MIN_TITLE_LENGTH) {
    return title;
  }

  // Exit early if the delimiter was found too close to the end
  const MIN_PUBLISHER_NAME_LENGTH = 5;
  const remaining_char_count = title.length - delimiter_position;
  if (remaining_char_count < MIN_PUBLISHER_NAME_LENGTH) {
    return title;
  }

  // Break apart the tail into words
  const delimiter_length = 3;
  const tail = title.substring(delimiter_position + delimiter_length);
  const words = tokenize(tail);

  // If there are too many words, return the full title, because tail is
  // probably not a publisher
  const MAX_TAIL_WORDS = 4;
  if (words.length > MAX_TAIL_WORDS) {
    return title;
  }

  return title.substring(0, delimiter_position).trim();
}

// Break apart string into array of words
function tokenize(value) {
  if (typeof value === 'string') {
    // Avoid empty tokens by trimming and checking length
    const trimmed_input = value.trim();
    if (trimmed_input.length) {
      return trimmed_input.split(/\s+/g);
    }
  }
  return [];
}
