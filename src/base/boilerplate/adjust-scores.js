
export function adjust_scores(
    blocks, document_length, delta = 1, max_iterations = 20,
    content_threshold = 0, ratio_threshold = 0) {
  let iterations = 0;
  let content_length =
      get_content_length(blocks, document_length, content_threshold);
  let ratio = content_length / (document_length || 1);
  while (ratio < ratio_threshold && iterations < max_iterations) {
    let adjustment_per_iteration = 0;

    for (const block of blocks) {
      if (block.score < content_threshold) {
        block.score += delta;
        adjustment_per_iteration += delta;
      }
    }

    if (adjustment_per_iteration === 0) {
      break;
    }

    content_length =
        get_content_length(blocks, document_length, content_threshold);
    ratio = content_length / (document_length || 1);
    iterations++;
  }

  return blocks;
}

// Get the total length of non-boilerplate content. This works
// counter-intuitively by finding the disjoint set of boilerplate blocks,
// summing their lengths, and substracting that from document length.
export function get_content_length(blocks, document_length, threshold) {
  let length = 0;
  for (const block of blocks) {
    if (block.score < threshold &&
        !has_boilerplate_ancestor(blocks, block, threshold)) {
      length += block.text_length;
    }
  }

  return document_length - length;
}

// Given a block, check its ancestors. If any ancestor is boilerplate, return
// true. Otherwise, return false. The block itself is not considered.
function has_boilerplate_ancestor(blocks, block, threshold) {
  let index = block.parent_block_index;
  while (index !== -1) {
    const cursor = blocks[index];
    if (cursor.score < threshold) {
      return true;  // found a boilerplate ancestor
    }
    index = cursor.parent_block_index;
  }

  // either no ancestors, or no boilerplate ancestors found
  return false;
}
