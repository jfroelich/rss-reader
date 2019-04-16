import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import getPathExtension from '/lib/get-path-extension.js';

function getPathExtensionTest() {
  // Exercise the normal case
  let result = getPathExtension('/b.html');
  assert(result === 'html', `result: ${result}`);

  // invalid path (missing leading slash) should fail
  result = getPathExtension('foo');
  assert(!result);

  // no extension should fail
  result = getPathExtension('/foo');
  assert(!result);

  // Should fail without error when there is a trailing period
  result = getPathExtension('/b.');
  assert(!result);

  result = getPathExtension('/.htaccess');
  assert(result === 'htaccess');

  // Should fail without error when the extension has too many characters,
  // here we use the explicit value despite it being equal to the default for
  // the moment, to insulate against change to the default and use express
  // expression
  result = getPathExtension('/b.01234567890123456789asdf', 10);
  assert(!result);

  // period in path not filename
  result = getPathExtension('/a.b/c');
  assert(!result, `result: ${result}`);
}

TestRegistry.registerTest(getPathExtensionTest);
