import Entry from '/src/db/object/entry.js';
import normalize_entry from '/src/db/ops/normalize-entry.js';
import assert from '/src/lib/assert.js';

export function normalize_entry_test() {
  let entry = new Entry();

  // test when missing fields
  // this should run without error
  normalize_entry(entry);
  // should not have somehow introduced values where none existed
  assert(entry.author === undefined);
  assert(entry.title === undefined);
  assert(entry.content === undefined);

  // wrong property type should raise error
  entry.author = 1234;
  let expected_error = undefined;
  try {
    normalize_entry(entry);
  } catch (error) {
    expected_error = error;
  }
  assert(expected_error instanceof Error);

  // reset so if i forget about it later in this function it does not matter
  entry = new Entry();

  // test basic strings where no change expected
  entry.author = 'foo';
  entry.title = 'bar';
  entry.content = 'baz';

  // should run without error
  normalize_entry(entry);

  // values should be the same
  assert(entry.author === 'foo');
  assert(entry.title === 'bar');
  assert(entry.content === 'baz');

  // reset again out of paranoia
  entry = new Entry();

  // Now test a case where a value is modified as a result of normalization
  // https://unicode.org/reports/tr15/

  // 😱
  assert('Å' === '\u212b');  // not normalized
  assert('Å' === '\u00c5');  // normalized

  entry.author = '\u212b';
  normalize_entry(entry);
  assert(entry.author === '\u00c5', escape_unicode(entry.author));

  // test idempotency. repeating the operation on the already normalized value
  // should be an effective noop (should not destroy equality property).
  normalize_entry(entry);
  assert(entry.author === '\u00c5', escape_unicode(entry.author));
}

// https://stackoverflow.com/questions/21014476
function escape_unicode(string) {
  return string.replace(/[^\0-~]/g, function(ch) {
    return '\\u' + ('000' + ch.charCodeAt(0).toString(16)).slice(-4);
  });
}
