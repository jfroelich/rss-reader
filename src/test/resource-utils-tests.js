import * as resourceUtils from '/src/db/resource-utils.js';
import TestRegistry from '/src/test/test-registry.js';
import assert from '/src/lib/assert.js';

function isValidIdTest() {
  assert(!resourceUtils.isValidId(-1));
  assert(!resourceUtils.isValidId(0));
  assert(!resourceUtils.isValidId('hello'));
  assert(!resourceUtils.isValidId(true));
  assert(!resourceUtils.isValidId(false));
  assert(resourceUtils.isValidId(1));
  assert(resourceUtils.isValidId(123456789));
}

function appendURLTest() {
  // Append a url
  const resource = {};
  let appended = resourceUtils.setURL(resource, new URL('a://b.c1'));
  assert(appended === true);
  assert(resource.urls);
  assert(resource.urls.length === 1);

  // Append a second url
  const url2 = new URL('a://b.c2');
  appended = resourceUtils.setURL(resource, url2);
  assert(appended);
  assert(resource.urls);
  assert(resource.urls.length === 2);

  // Append a duplicate
  appended = resourceUtils.setURL(resource, url2);
  assert(!appended);
  assert(resource.urls.length === 2);
}

function normalizeResourceTest() {
  let resource = {};
  // test when missing fields
  resourceUtils.normalize(resource);
  // should not have somehow introduced values where none existed
  assert(resource.author === undefined);
  assert(resource.title === undefined);
  assert(resource.content === undefined);

  // wrong property type should raise error
  resource.author = 1234;
  let expectedError;
  try {
    resourceUtils.normalize(resource);
  } catch (error) {
    expectedError = error;
  }
  assert(expectedError instanceof Error);

  // test basic strings where no change expected
  resource = {};
  resource.author = 'foo';
  resource.title = 'bar';
  resource.content = 'baz';

  // should run without error
  resourceUtils.normalize(resource);

  // values should be the same
  assert(resource.author === 'foo');
  assert(resource.title === 'bar');
  assert(resource.content === 'baz');

  // Now test a case where a value is modified as a result of normalization
  // https://unicode.org/reports/tr15/
  resource = {};
  assert('Å' === '\u212b'); // not normalized
  assert('Å' === '\u00c5'); // normalized
  resource.author = '\u212b';
  resourceUtils.normalize(resource);
  assert(resource.author === '\u00c5', escapeUnicodeString(resource.author));

  // test idempotency
  resourceUtils.normalize(resource);
  assert(resource.author === '\u00c5', escapeUnicodeString(resource.author));
}

// https://stackoverflow.com/questions/21014476
function escapeUnicodeString(string) {
  return string.replace(/[^\0-~]/g, ch => `\\u${(`000${ch.charCodeAt(0).toString(16)}`).slice(-4)}`);
}

function sanitizeTest() {
  const resource = {};
  let content = 'hello world';
  resource.content = content;
  resourceUtils.sanitize(resource);
  assert(resource.content === content);

  // Verify line breaks are retained in content prop
  content = '<html><head></head><body>hello\nworld</body></html>';
  resource.content = content;
  resourceUtils.sanitize(resource);
  const expected = '<html><head></head><body>hello\nworld</body></html>';
  assert(resource.content === expected, resource.content);
}

TestRegistry.registerTest(isValidIdTest);
TestRegistry.registerTest(appendURLTest);
TestRegistry.registerTest(normalizeResourceTest);
TestRegistry.registerTest(sanitizeTest);
