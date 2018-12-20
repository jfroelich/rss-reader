export function filter_publisher(
    title, delims = ['-', '|', ':'], max_tail_words = 4, min_title_length = 20,
    min_publisher_length = 5) {
  // Tolerate bad input (Postel's Law)
  if (typeof title !== 'string') {
    return title;
  }

  let delim_pos = -1;
  for (const delim of delims) {
    delim_pos = title.lastIndexOf(' ' + delim + ' ');
    if (delim_pos > -1) {
      break;
    }
  }

  if (delim_pos < 0) {
    return title;
  }

  if (delim_pos < min_title_length) {
    return title;
  }

  const remaining = title.length - delim_pos;
  if (remaining < min_publisher_length) {
    return title;
  }

  const delim_len = 3;
  const tail = title.substring(delim_pos + delim_len);
  if (count_words(tail) > max_tail_words) {
    return title;
  }

  return title.substring(0, delim_pos).trim();
}

export function count_words(value) {
  return tokenize(value).length;
}

// Split a string into smaller strings based on intermediate whitespace
export function tokenize(value) {
  if (typeof value === 'string') {
    // Avoid empty tokens
    const trimmed = value.trim();
    if (trimmed.length) {
      return trimmed.split(/\s+/g);
    }
  }
  return [];
}
