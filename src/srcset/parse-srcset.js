import '/third-party/parse-srcset.js';

// The parse_srcset function parses a string value into an array of descriptors.
// If the input is bad, or an error occurs, or no descriptors found, returns an
// empty array. The srcset param may be any value, but should generally be a
// string containing the value of the srcset attribute of an html element.
export function parse_srcset(value) {
  return (value && typeof value === 'string') ? parseSrcset(value) : [];
}
