import {assert} from '/src/assert/assert.js';
import * as url_utils from '/src/url-utils/url-utils.js';

export async function url_get_extension_tests() {
  // Exercise the simple typical success case
  let input = new URL('http://www.a.com/b.html');
  let result = url_utils.url_get_extension(input);
  assert(result === 'html');

  // Should fail without error when there is a trailing period
  input = new URL('http://www.a.com/b.');
  result = url_utils.url_get_extension(input);
  assert(!result);

  // TODO: get this test passing again
  // leading period should find extension
  // input = new URL('http://www.a.com/.htaccess');
  // result = url_utils.url_get_extension(input);
  // assert(result === 'htaccess');

  // Should fail without error when the extension has too many characters
  input = new URL('http://www.a.com/b.01234567890123456789asdf');
  result = url_utils.url_get_extension(input);
  assert(!result);
}
