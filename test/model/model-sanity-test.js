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

  // BUG: this is currently failing because sanitize_entry internally calls
  // filter_controls, which strips line breaks. line breaks should not be
  // filtered from content. therefore sanitize_entry's behavior is incorrect
  content = '<html><head></head><body>hello\nworld</body></html>';
  entry.content = content;
  sanity.sanitize_entry(entry);
  let expected = '<html><head></head><body>hello\nworld</body></html>';
  assert(
      entry.content === expected,
      'unexpected output: expected ' + expected + ' but received ' +
          entry.content);
}

register_test(sanitize_entry_content_test);
