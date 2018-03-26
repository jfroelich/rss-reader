
const DEFAULT_OPTIONS = {
  max_tail_words: 4,
  min_title_length: 20,
  min_publisher_length: 5,
  delims: [' - ', ' | ', ' : ']
};

export function filter_publisher(title, input_options = {}) {
  if (typeof title !== 'string') {
    return title;
  }

  const options = Object.assign({}, DEFAULT_OPTIONS, input_options);

  let delim_pos = -1;
  for (const delim of options.delims) {
    delim_pos = title.lastIndexOf(delim);
    if (delim_pos > -1) {
      break;
    }
  }

  if (delim_pos < 0) {
    return title;
  }

  if (delim_pos < options.min_title_length) {
    return title;
  }

  const remaining = title.length - delim_pos;
  if (remaining < options.min_publisher_length) {
    return title;
  }

  const delim_len = 3;
  const tail = title.substring(delim_pos + delim_len);
  if (count_words(tail) > options.max_tail_words) {
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
