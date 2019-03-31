import sanitize_entry from '/src/db/ops/sanitize-entry.js';
import assert from '/src/lib/assert.js';

export default function sanitize_entry_test() {
  const entry = {};
  let content = 'hello world';
  entry.content = content;
  sanitize_entry(entry);
  assert(entry.content === content);

  // Verify line breaks are retained
  content = '<html><head></head><body>hello\nworld</body></html>';
  entry.content = content;
  sanitize_entry(entry);
  let expected = '<html><head></head><body>hello\nworld</body></html>';
  assert(entry.content === expected, entry.content);
}
