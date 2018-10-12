


// TODO: move all the scoring here. in fact score_block should not be a
// parameter to this function. the score function should basically be the one
// public method of a model instance.

// TODO: decide whether the model should operate off an entire dataset, or off
// a particular row of that dataset. e.g. do i want a dataset model or a block
// model?

export function score_dataset(dataset, score_block, info) {
  for (const block of dataset) {
    block.score = score_block(block, info);
  }

  return dataset;
}
