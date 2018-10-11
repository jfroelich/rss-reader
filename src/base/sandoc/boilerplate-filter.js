import * as boilerplate from '/src/base/boilerplate/boilerplate.js';

// We create our model once
const model = boilerplate.create_model();

export function filter_boilerplate(document, options = {}) {
  const dataset =
      boilerplate.create_block_dataset(document, boilerplate.neutral_score);
  boilerplate.extract_features(dataset, options);

  const scored_dataset = boilerplate.classify(dataset, model);

  for (const row of scored_dataset) {
    if (row.score < boilerplate.neutral_score) {
      const element = boilerplate.find_block_element(document, row);
      if (element) {
        element.remove();
      }
    }
  }
}
