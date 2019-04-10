import assert from '/lib/assert.js';
import get_path_extension from '/lib/get-path-extension.js';

export default function get_path_extension_test() {
  // Exercise the normal case
  let result = get_path_extension('/b.html');
  assert(result === 'html', 'result: ' + result);

  // invalid path (missing leading slash) should fail
  result = get_path_extension('foo');
  assert(!result);

  // no extension should fail
  result = get_path_extension('/foo');
  assert(!result);

  // Should fail without error when there is a trailing period
  result = get_path_extension('/b.');
  assert(!result);

  result = get_path_extension('/.htaccess');
  assert(result === 'htaccess');

  // Should fail without error when the extension has too many characters,
  // here we use the explicit value despite it being equal to the default for
  // the moment, to insulate against change to the default and use express
  // expression
  result = get_path_extension('/b.01234567890123456789asdf', 10);
  assert(!result);

  // period in path not filename
  result = get_path_extension('/a.b/c');
  assert(!result, 'result: ' + result);
}
