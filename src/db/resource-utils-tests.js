import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';

export function is_valid_id_test() {
  assert(!resource_utils.is_valid_id(-1));
  assert(!resource_utils.is_valid_id(0));
  assert(!resource_utils.is_valid_id('hello'));
  assert(!resource_utils.is_valid_id(true));
  assert(!resource_utils.is_valid_id(false));
  assert(resource_utils.is_valid_id(1));
  assert(resource_utils.is_valid_id(123456789));
}

export function append_url_test() {
  // Append a url
  const resource = {};
  let appended = resource_utils.set_url(resource, new URL('a://b.c1'));
  assert(appended === true);
  assert(resource_utils.has_url(resource));
  assert(resource.urls.length === 1);

  // Append a second url
  const url2 = new URL('a://b.c2');
  appended = resource_utils.set_url(resource, url2);
  assert(appended);
  assert(resource_utils.has_url(resource));
  assert(resource.urls.length === 2);

  // Append a duplicate
  appended = resource_utils.set_url(resource, url2);
  assert(!appended);
  assert(resource.urls.length === 2);
}

export function normalize_resource_test() {
  let resource = {};

  // test when missing fields
  // this should run without error
  resource_utils.normalize(resource);
  // should not have somehow introduced values where none existed
  assert(resource.author === undefined);
  assert(resource.title === undefined);
  assert(resource.content === undefined);

  // wrong property type should raise error
  resource.author = 1234;
  let expected_error = undefined;
  try {
    resource_utils.normalize(resource);
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
  resource_utils.normalize(resource);

  // values should be the same
  assert(resource.author === 'foo');
  assert(resource.title === 'bar');
  assert(resource.content === 'baz');

  // Now test a case where a value is modified as a result of normalization
  // https://unicode.org/reports/tr15/
  resource = {};
  assert('Å' === '\u212b');  // not normalized
  assert('Å' === '\u00c5');  // normalized
  resource.author = '\u212b';
  resource_utils.normalize(resource);
  assert(resource.author === '\u00c5', escape_unicode(resource.author));

  // test idempotency
  resource_utils.normalize(resource);
  assert(resource.author === '\u00c5', escape_unicode(resource.author));
}

// https://stackoverflow.com/questions/21014476
function escape_unicode(string) {
  return string.replace(/[^\0-~]/g, function(ch) {
    return '\\u' + ('000' + ch.charCodeAt(0).toString(16)).slice(-4);
  });
}


export default function sanitize_test() {
  const resource = {};
  let content = 'hello world';
  resource.content = content;
  resource_utils.sanitize(resource);
  assert(resource.content === content);

  // Verify line breaks are retained in content prop
  content = '<html><head></head><body>hello\nworld</body></html>';
  resource.content = content;
  resource_utils.sanitize(resource);
  let expected = '<html><head></head><body>hello\nworld</body></html>';
  assert(resource.content === expected, resource.content);
}
