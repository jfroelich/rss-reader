import assert from '/src/lib/assert.js';
import * as bp from '/src/lib/boilerplate2.js';

// We create our model once
const model = bp.create_model();

export function filter_boilerplate(document, options = {}) {
  assert(document);
  const dataset = bp.create_block_dataset(document, options.max_token_length);
  const scored_dataset = bp.classify(dataset, model);

  for (const row of scored_dataset) {
    if (row.score < bp.neutral_score) {
      const element = bp.find_block_element(document, row);
      if (element) {
        element.remove();
      }
    }
  }
}
