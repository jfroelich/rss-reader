// TODO: move all the scoring here

// TODO: aggregate params
export function score_dataset(
    dataset, score_block, info, neutral_score, threshold) {
  for (const block of dataset) {
    block.score = score_block(block, info);
  }

  rescore(dataset, info.text_length, neutral_score, threshold);

  return dataset;
}

// TODO: aggregate params
function rescore(
    blocks, document_text_length, neutral_score, minimum_content_threshold) {
  if (!document_text_length) {
    return;
  }

  if (!blocks.length) {
    return;
  }

  // This is about how far we are willing to go before giving up on promoting
  // boilerplate into content (given score adjustment by 1% at a time). Note
  // this implies we may not even reach the desired minimum threshold if we stop
  // bumping early.
  const max_iterations = 20;
  let iterations = 0;

  // Loop over the blocks, uniformly incrementing boilerplate block scores a bit
  // each iteration, until we reach the minimum content threshold or give up
  // after a number of iterations.
  let content_text_length = get_visible_content_length(blocks, neutral_score);
  let ratio = content_text_length / (document_text_length || 1);
  while (ratio < minimum_content_threshold && iterations < max_iterations) {
    // TEMP: debugging
    console.debug(
        'Adjusting scores to meet min-content-length threshold', ratio,
        minimum_content_threshold);

    // TODO: track adjustment per iteration. If no score change will result,
    // this is another reason to stop.

    let adjustment_per_iteration = 0;

    // Slightly adjust all low scores. We do not favor any particular
    // block, everything gets a bump. This uniformly distributes some positive
    // bias because I think it indicates a generally flawed model.
    for (const block of blocks) {
      if (block.score < neutral_score) {
        block.score += 1;
        adjustment_per_iteration += 1;
      }
    }

    // If we did not make any adjustments, that is a stopping condition
    if (adjustment_per_iteration === 0) {
      // TEMP: just hackishly monitoring this new functionality for a bit
      console.debug(
          'Min content threshold check resulted in no adjustment', ratio,
          minimum_content_threshold);

      break;
    }

    content_text_length = get_visible_content_length(blocks, neutral_score);
    ratio = content_text_length / document_text_length;
    iterations++;
  }
}

// TODO: this should be using a helper function, block_is_visible, that operates
// upon a single block and returns whether it is visible or not.

// Get the total text length of all non-boilerplate blocks. A block only
// contributes to visible length when the block itself is visible and all of its
// ancestors are visible.
function get_visible_content_length(blocks, neutral_score) {
  let length = 0;
  for (const block of blocks) {
    let visible = block.score >= neutral_score;
    let index = block.parent_block_index;
    while (visible && index > -1) {
      const ancestor = blocks[index];
      if (ancestor.score < neutral_score) {
        visible = false;
      } else {
        index = ancestor.parent_block_index;
      }
    }

    if (visible) {
      length += block.text_length;
    }
  }
  return length;
}
