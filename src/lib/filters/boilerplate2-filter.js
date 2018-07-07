import assert from '/src/lib/assert.js';
import * as bp from '/src/lib/boilerplate2.js';

// We create our model once
const model_evaluator = bp.create_model();

export function filter_boilerplate(document) {
  assert(document);

  // Classify content using default options and model
  const dataset = bp.classify(document, model_evaluator);

  for (const row of dataset) {
    if (row.score < bp.neutral_score) {
      const element = bp.find_block_element(document, row);
      element.remove();
    }
  }
}
