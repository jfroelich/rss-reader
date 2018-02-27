const MAX_TAIL_WORDS = 4;
const MIN_TITLE_LENGTH = 20;
const MIN_PUBLISHER_NAME_LENGTH = 5;

export function filter_title_publisher(title) {
  const delimiter_length = 3;

  if (typeof title !== 'string') {
    return title;
  }

  let delimiter_position = title.lastIndexOf(' - ');
  if (delimiter_position < 0) {
    delimiter_position = title.lastIndexOf(' | ');
  }
  if (delimiter_position < 0) {
    delimiter_position = title.lastIndexOf(' : ');
  }

  if (delimiter_position < 0) {
    return title;
  }

  if (delimiter_position < MIN_TITLE_LENGTH) {
    return title;
  }

  const remaining_char_count = title.length - delimiter_position;
  if (remaining_char_count < MIN_PUBLISHER_NAME_LENGTH) {
    return title;
  }

  const tail = title.substring(delimiter_position + delimiter_length);
  if (count_words(tail) > MAX_TAIL_WORDS) {
    return title;
  }

  return title.substring(0, delimiter_position).trim();
}

function count_words(value) {
  return tokenize(value).length;
}

function tokenize(value) {
  if (typeof value === 'string') {
    // Avoid empty tokens
    const trimmed_input = value.trim();
    if (trimmed_input.length) {
      return trimmed_input.split(/\s+/g);
    }
  }
  return [];
}
