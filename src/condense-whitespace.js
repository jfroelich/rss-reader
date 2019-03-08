// TODO: this module may be a good example of where it is better to
// repeat yourself rather than couple disparate modules together on
// this very simple dependency.

export function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}
