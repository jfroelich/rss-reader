export function adjust_scores(blocks, options) {
  let document_length = options.document_length;
  if (document_length === undefined) {
    document_length = 0;
  }

  assert(Number.isInteger(document_length));

  let delta = options.delta;
  if (delta === undefined) {
    delta = 1;
  }

  let max_iterations = options.max_iterations;
  if (max_iterations === undefined) {
    max_iterations = 20;
  }

  let content_threshold = options.content_threshold;
  if (content_threshold === undefined) {
    content_threshold = 0;
  }

  let ratio_threshold = options.ratio_threshold;
  if (ratio_threshold === undefined) {
    ratio_threshold = 0;
  }

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
// summing their lengths, and substracting that from document length. This
// strange way of doing this avoids issues with double counting lengths of
// nested non-boilerplate blocks.
export function get_content_length(blocks, document_length, threshold) {
  // Assume document_length is >= 0.

  // Avoid doing work if there is no point
  if (document_length === 0) {
    return 0;
  }

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
// TODO: should block be the first parameter since that is what this primarily
// operates on?
// TODO: is threshold an ambiguous name for a parameter?
function has_boilerplate_ancestor(blocks, block, threshold) {
  // We assume blocks is a defined array of blocks with at least one block.
  // We assume block is a defined block object.
  // We assume threshold is an integer
  // We assume that if parent_block_index is not -1, it points to a valid
  // in-bounds index of another block that is also a defined block object.
  // We assume that block has a score property that was set previously.

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

function assert(condition, message = 'Assertion error') {
  if (!condition) {
    throw new Error(message);
  }
}
