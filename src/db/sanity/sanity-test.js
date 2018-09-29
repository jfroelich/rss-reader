import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as sanity from '/src/db/sanity/sanity.js';
import {register_test} from '/src/test/test-registry.js';

async function sanitize_entry_content_test() {
  // TODO: validate truncation behavior?

  const entry = entry_utils.create_entry();

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

register_test(sanitize_entry_content_test);
