import {assert} from '/src/assert.js';
import {get_url_filename_extension} from '/src/get-url-filename-extension/get-url-filename-extension.js';

export function get_url_extension_tests() {
  // Exercise the simple typical success case
  let input = new URL('http://www.a.com/b.html');
  let result = get_url_filename_extension(input);
  assert(result === 'html');

  // Should fail without error when there is a trailing period
  input = new URL('http://www.a.com/b.');
  result = get_url_filename_extension(input);
  assert(!result);

  // TODO: get this test passing again
  // leading period should find extension
  // input = new URL('http://www.a.com/.htaccess');
  // result = get_url_filename_extension(input);
  // assert(result === 'htaccess');

  // Should fail without error when the extension has too many characters
  input = new URL('http://www.a.com/b.01234567890123456789asdf');
  result = get_url_filename_extension(input);
  assert(!result);
}
