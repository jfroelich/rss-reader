import Entry from '/src/db/entry.js';
import sanitize_entry from '/src/db/ops/sanitize-entry.js';
import assert from '/src/lib/assert.js';

export default function sanitize_entry_test() {
  const entry = new Entry();
  let content = 'hello world';
  entry.content = content;
  sanitize_entry(entry);
  assert(entry.content === content);

  // Test that line breaks are not filtered from content. This was previously
  // the source of a bug, where filter_controls was used in place of
  // filter_unprintables within sanitize_entry, where filter_controls matches \n
  // and such, but filter_unprintables does not
  content = '<html><head></head><body>hello\nworld</body></html>';
  entry.content = content;
  sanitize_entry(entry);
  let expected = '<html><head></head><body>hello\nworld</body></html>';
  assert(entry.content === expected, entry.content);
}
