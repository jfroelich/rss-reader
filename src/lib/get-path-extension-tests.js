import assert from '/src/lib/assert.js';
import get_path_extension from '/src/lib/get-path-extension.js';

export function get_path_extension_tests() {
  // Exercise the normal case
  let result = get_path_extension('/b.html');
  assert(result === 'html');

  // Should fail without error when there is a trailing period
  result = get_path_extension('b.');
  assert(!result);

  // TODO: get this test passing again, leading period should find extension
  // result = get_path_extension('.htaccess');
  // assert(result === 'htaccess');

  // Should fail without error when the extension has too many characters
  result = get_path_extension('b.01234567890123456789asdf');
  assert(!result);
}
