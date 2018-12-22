import assert from '/src/assert.js';
import {adjust_scores} from './adjust-scores.js';
import * as utils from './utils.js';

export {score_block} from './simple-model.js';
export * from './feature-extraction.js';
export * from './block-parser.js';

export const neutral_score = 50;

// Given a dataset representing content sections of a document, produce a scored
// dataset indicating which elements in the dataset are boilerplate.
//
// Options:
// - tail_size {Number} optional, should be in range [0..0.5), determines what
// percentage of content blocks fall into header and footer sections
// - document_area {Number} optional, the default dimensions of a document to
// use when determining the proportional size of content blocks
// - minimum_content_threshold {Number} optional, should be in range 0-100,
// indicating minimum desired percentage of content vs. boilerplate
export function classify(dataset, score_block, options = {}) {
  assert(Array.isArray(dataset));

  if (!dataset.length) {
    return dataset;
  }

  const document = dataset[0].element.ownerDocument;
  assert(typeof document === 'object');
  assert(typeof score_block === 'function');

  const tail_size = isNaN(options.tail_size) ? 0.2 : options.tail_size;
  assert(!isNaN(tail_size));
  assert(tail_size >= 0 && tail_size < 0.5);

  const default_document_area = 1500 * 2000;
  const document_area = isNaN(options.document_area) ? default_document_area :
                                                       options.document_area;
  assert(Number.isInteger(document_area));
  assert(document_area >= 0);

  // TODO: these statements should be located closer to where the result is used
  const default_minimum_content_threshold = 20;
  let minimum_content_threshold = isNaN(options.minimum_content_threshold) ?
      default_minimum_content_threshold :
      options.minimum_content_threshold;
  minimum_content_threshold = minimum_content_threshold / 100;

  let text_length = 0;
  if (document.body) {
    text_length = utils.get_text_length(document.body.textContent);
  }

  let num_elements = 0;
  if (document.body) {
    num_elements = document.body.getElementsByTagName('*').length;
  }
  const front_max = (tail_size * num_elements) | 0;
  const end_min = num_elements - front_max;

  const info = {
    text_length: text_length,
    front_max: front_max,
    end_min: end_min,
    area: document_area
  };

  for (const block of dataset) {
    block.score = score_block(block, info, neutral_score);
  }

  // adjustment options
  const ao = {};
  ao.document_length = text_length;
  ao.delta = 2;
  ao.max_iterations = 20;
  ao.content_threshold = neutral_score;
  ao.ratio_threshold = minimum_content_threshold;
  return adjust_scores(dataset, ao);
}

// Given a scored dataset representing a document, annotate the document
export function annotate_document(document, dataset) {
  for (const block of dataset) {
    const element = find_block_element(document, block);
    if (!element) {
      continue;
    }

    element.setAttribute('score', block.score);

    if (block.score > 74) {
      element.setAttribute('boilerplate', 'lowest');
    } else if (block.score > 49) {
      element.setAttribute('boilerplate', 'low');
    } else if (block.score > 24) {
      element.setAttribute('boilerplate', 'high');
    } else {
      element.setAttribute('boilerplate', 'highest');
    }
  }
}

// Given a block, get its represented element
export function find_block_element(document, block) {
  // TODO: for now, cheat, but maybe use something like element index
  assert(block.element);
  assert(block.element.ownerDocument === document);
  return block.element;
}
