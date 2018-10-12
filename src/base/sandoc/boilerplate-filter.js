import * as boilerplate from '/src/base/boilerplate/boilerplate.js';

// We create our model once
const model = boilerplate.create_model();

export function filter_boilerplate(document, options = {}) {
  const dataset =
      boilerplate.parse_blocks(document, boilerplate.neutral_score);
  boilerplate.extract_features(dataset, options);

  const scored_dataset = boilerplate.classify(dataset, model);

  for (const row of scored_dataset) {
    if (row.score < boilerplate.neutral_score) {
      const element = boilerplate.find_block_element(document, row);

      // Elements should always be found
      assert(element);

      element.remove();
    }
  }
}

function assert(condition) {
  if (!condition) {
    throw new Error('Assertion error');
  }
}
