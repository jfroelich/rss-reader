// Truncates an HTML string
// @param html_string {String}
// @param position {Number} position after which to truncate
// @param suffix {String} optional, appended after truncation, defaults to an
// ellipsis
export function html_truncate(html_string, position, suffix) {
  // Allow for bad input, for convenience
  if (typeof html_string !== 'string') {
    return '';
  }

  if (!Number.isInteger(position)) {
    throw new TypeError('position must be an integer');
  }

  if (position < 0) {
    throw new TypeError('position must be positive');
  }

  const ELLIPSIS = '\u2026';
  if (typeof suffix !== 'string') {
    suffix = ELLIPSIS;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html_string, 'text/html');
  const error = document.querySelector('parsererror');
  if (error) {
    return 'Unsafe malformed html string';
  }

  // Search for the text node in which truncation should occur and truncate it
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  let total_length = 0;

  for (let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const value_length = value.length;
    if (total_length + value_length >= position) {
      const remaining_length = position - total_length;
      node.nodeValue = value.substr(0, remaining_length) + suffix;
      break;
    } else {
      total_length += value_length;
    }
  }

  // Remove remaining nodes past the truncation point
  for (let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }

  // Return either the full text or the fragment
  if (/<html/i.test(html_string)) {
    return document.documentElement.outerHTML;
  } else {
    return document.body.innerHTML;
  }
}
