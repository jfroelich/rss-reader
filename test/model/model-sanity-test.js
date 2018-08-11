import assert from '/src/lib/assert.js';
import * as sanity from '/src/model/model-sanity.js';
import * as model from '/src/model/model.js';
import {register_test} from '/test/test-registry.js';

async function sanitize_entry_content_test() {
  // TODO: validate truncation behavior?

  const entry = model.create_entry();

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
