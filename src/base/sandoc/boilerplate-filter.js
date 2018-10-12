import * as boilerplate from '/src/base/boilerplate/boilerplate.js';

export function filter_boilerplate(document, options = {}) {
  let dataset = boilerplate.parse_blocks(document, boilerplate.neutral_score);
  assert(dataset);
  dataset = boilerplate.extract_features(dataset, options);
  assert(dataset);

  dataset = boilerplate.classify(dataset, boilerplate.score_block);
  assert(dataset);

  for (const row of dataset) {
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
