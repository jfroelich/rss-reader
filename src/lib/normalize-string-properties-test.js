import assert from '/src/lib/assert.js';
import normalize_string_properties from '/src/lib/normalize-string-properties.js';

export function normalize_string_properties_test() {
  // The test inputs and outputs are pulled from the MDB documentation
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/
  // Reference/Global_Objects/String/normalize

  // Test using the default form
  let input = {value: '\u1E9B\u0323'};
  normalize_string_properties(input);
  assert(input.value === '\u1E9B\u0323');
  console.debug(escape_unicode('\u1E9B\u0323'), escape_unicode(input.value));

  // Test using a non-default variant
  input = {value: '\u1E9B\u0323'};
  normalize_string_properties(input, 'NFKC');
  assert(input.value === '\u1E69');
  console.debug(escape_unicode('\u1E9B\u0323'), escape_unicode(input.value));
}

// ripped from https://stackoverflow.com/questions/21014476
function escape_unicode(string) {
  return string.replace(/[^\0-~]/g, function(ch) {
    return '\\u' + ('000' + ch.charCodeAt().toString(16)).slice(-4);
  });
}
