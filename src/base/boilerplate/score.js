// PRIMARY TODO: I want to solve the double counting problem. I think to match
// how document-length is calculated, what i want to do is get total length, and
// then get the total length of boilerplate blocks, the substract that. this way
// i do not naively sum up lengths of content blocks and double count. but note
// that this still assumes that if an ancestor is boilerplate, then all its
// descendants are boilerplate too. this is also a separate and more fundamental
// question. right now i just look at filter behavior, it just strips by block
// if boilerplate, meaning that it implicitly strips descendants, meaning i have
// kind of already made my decision


// TODO: move all the scoring here. in fact score_block should not be a
// parameter to this function. the score function should basically be the one
// public method of a model instance.

// TODO: decide whether the model should operate off an entire dataset, or off
// a particular row of that dataset. e.g. do i want a dataset model or a block
// model? i lean towards block, but then how to handle the adjust_scores
// concern? is adjust_scores a concern of the model itself or should it be
// oriented as a post- model scoring adjustment, like a generic data processing
// step that occurs after scoring?

export function score_dataset(
    dataset, score_block, info, neutral_score, threshold) {
  for (const block of dataset) {
    block.score = score_block(block, info);
  }

  return adjust_scores(dataset, info.text_length, neutral_score, threshold);
}

// Adjusts block scores until a minimum amount of a non-boilerplate content
// remains. Or at least it tries to do so and gives up after a while.
function adjust_scores(
    blocks, document_text_length, neutral_score, minimum_content_threshold) {
  if (!document_text_length) {
    return blocks;
  }

  if (!blocks.length) {
    return blocks;
  }

  // TODO: max_iterations should not be hardcoded, this is a parameter. it can
  // surely default to 20 like now, if the caller does not care, but it should
  // still be a decision the caller is able to make.

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

  return blocks;
}



// Get the total text length of all non-boilerplate blocks. A block only
// contributes to length when the block is visible.
// TODO: if blocks are hierarchical, then is this duplicating length because
// of the overlap? this seems entirely incorrect???? i want to get the length
// without double counting the overlap of blocks. so what i want to do really
// is find the set of all disconnected content blocks first, then add up their
// lengths. i should iron this out with a test and be really clear. this might
// be the reason i am not seeing the adjustment have much of an effect, leading
// to a lot of blanked articles.
//
// but to add to that, now i am confused. let's say i have blocks abc, a
// contains b and c. a is content, b is content, and c is boilerplate. what is
// the total content length in this case? so right now the algorithm returns
// a+b, which i am pointing out is wrong, because it double counts b's length,
// because it counts b for b, and b for a as well. so it should not be a+b. it
// should just be b?
//
// what if b is boiler? then it should be a + -b + -c?

function get_visible_content_length(blocks, neutral_score) {
  let length = 0;
  for (const block of blocks) {
    if (block_is_visible_content(block, neutral_score)) {
      length += block.text_length;
    }
  }
  return length;
}

// Returns whether the block represents content meaning that the block is not
// boilerplate, and none of its ancestor nodes are boilerplate. Because if any
// of its ancestors are boilerplate then the block itself may be considered
// boilerplate even though it represents content.
//
// This does not perfectly mirror the DOM hierarchy, because not all DOM nodes
// are blocks. Not all DOM nodes are visited.
//
// This function pertains specifically to blocks, but it is not a member of
// the block object, because this deals with a property, score, that is not
// native to the block object. or at least, it should not be treated as native
// to the block object. so it is more correct to position this function in the
// one place that uses it, because it would be wrong to have a method that
// actions on a member property that does not exist as an invariant to the
// object's shape.
//
// TODO: implement tests
function block_is_visible_content(block, threshold) {
  // blocks are stored in an array, even though there is a hierarchical
  // characteristic to them, because of how fast array iteration is compared
  // to tree iteration. each block stores a 'pointer' to its parent in the
  // hierarchy by simply storing the index of the parent block in the blocks
  // array as a property of the block. if a block has no parent then its
  // parent block index is -1, which is outside the bounds of the array.
  // however, as a matter of best practice, this does bounds checking even
  // though it would be possible to just set cursor to the out of bounds
  // location and take advantage of the fact it would also be set to undefined
  // as a result.

  let cursor = block;
  while (cursor) {
    if (cursor.score < threshold) {
      return false;
    }

    const index = cursor.parent_block_index;
    cursor = index < 0 ? undefined : blocks[index];
  }

  return true;
}
