import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as sanity from '/src/db/sanity.js';

// TODO: validate truncation behavior?

export async function sanitize_entry_content_test() {
  // Test setup. Create a reusable entry object for input to sub tests.
  const entry = entry_utils.create_entry_object();

  // Test the simple ordinary usage. Here no sanitization needs to take place,
  // so test that the value is not somehow clobbered, returns a string.
  let content = 'hello world';
  entry.content = content;
  sanity.sanitize_entry(entry);
  assert(entry.content === content);

  // Test that line breaks are not filtered from content. This was previously
  // the source of a bug, where filter_controls was used in place of
  // filter_unprintables, where filter_controls matches \n and such, but
  // filter_unprintables does not
  content = '<html><head></head><body>hello\nworld</body></html>';
  entry.content = content;
  sanity.sanitize_entry(entry);
  let expected = '<html><head></head><body>hello\nworld</body></html>';
  assert(entry.content === expected, entry.content);
}
