// Return an approximate count of the characters in a string. This ignores outer
// whitespace excessive inner whitespace.
export function get_text_length(text) {
  const trimmed_text = text.trim();
  const condensed_text = trimmed_text.replace(/\s\s+/g, ' ');
  return condensed_text.length;
}
