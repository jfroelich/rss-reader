import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';

export function normalize_resource_test() {
  let resource = {};

  // test when missing fields
  // this should run without error
  resource_utils.normalize_resource(resource);
  // should not have somehow introduced values where none existed
  assert(resource.author === undefined);
  assert(resource.title === undefined);
  assert(resource.content === undefined);

  // wrong property type should raise error
  resource.author = 1234;
  let expected_error = undefined;
  try {
    resource_utils.normalize_resource(resource);
  } catch (error) {
    expected_error = error;
  }
  assert(expected_error instanceof Error);

  // test basic strings where no change expected
  resource = {};
  resource.author = 'foo';
  resource.title = 'bar';
  resource.content = 'baz';

  // should run without error
  resource_utils.normalize_resource(resource);

  // values should be the same
  assert(resource.author === 'foo');
  assert(resource.title === 'bar');
  assert(resource.content === 'baz');


  // Now test a case where a value is modified as a result of normalization
  // https://unicode.org/reports/tr15/
  // 😱

  resource = {};
  assert('Å' === '\u212b');  // not normalized
  assert('Å' === '\u00c5');  // normalized
  resource.author = '\u212b';
  resource_utils.normalize_resource(resource);
  assert(resource.author === '\u00c5', escape_unicode(resource.author));

  // test idempotency
  resource_utils.normalize_resource(resource);
  assert(resource.author === '\u00c5', escape_unicode(resource.author));
}

// https://stackoverflow.com/questions/21014476
function escape_unicode(string) {
  return string.replace(/[^\0-~]/g, function(ch) {
    return '\\u' + ('000' + ch.charCodeAt(0).toString(16)).slice(-4);
  });
}
