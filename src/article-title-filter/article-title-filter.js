const MAX_TAIL_WORDS = 4;
const MIN_TITLE_LENGTH = 20;
const MIN_PUBLISHER_NAME_LENGTH = 5;

export function filter_title_publisher(title) {
  const delim_len = 3;

  if (typeof title !== 'string') {
    return title;
  }

  let delim_pos = title.lastIndexOf(' - ');
  if (delim_pos < 0) {
    delim_pos = title.lastIndexOf(' | ');
  }
  if (delim_pos < 0) {
    delim_pos = title.lastIndexOf(' : ');
  }

  if (delim_pos < 0) {
    return title;
  }

  if (delim_pos < MIN_TITLE_LENGTH) {
    return title;
  }

  const remaining = title.length - delim_pos;
  if (remaining < MIN_PUBLISHER_NAME_LENGTH) {
    return title;
  }

  const tail = title.substring(delim_pos + delim_len);
  if (count_words(tail) > MAX_TAIL_WORDS) {
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
