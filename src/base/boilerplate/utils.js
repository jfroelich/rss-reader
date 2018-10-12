// TODO: if this is just one function, name file after the one function

export function get_text_length(text) {
  // Exclude trailing whitespace entirely. This effectively excludes common
  // text nodes such as '\t\n' from contributing to length.
  const trimmed_text = text.trim();
  // Condense inner whitespace. Note that I choose condense instead of just
  // completely ignoring whitespace, because to some extent the number of
  // intermediate spaces indicates the number of words, and therefore indicates
  // a longer amount of text.
  const condensed_text = trimmed_text.replace(/\s\s+/g, ' ');
  return condensed_text.length;
}
