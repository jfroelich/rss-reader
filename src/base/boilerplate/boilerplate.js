import {adjust_scores} from './adjust-scores.js';
import {Block} from './block.js';
import {score_dataset} from './score.js';
import * as utils from './utils.js';

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
export function classify(dataset, model, options = {}) {
  assert(Array.isArray(dataset));

  if (!dataset.length) {
    return dataset;
  }

  const document = dataset[0].element.ownerDocument;
  assert(typeof document === 'object');
  assert(typeof model === 'function');

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

  score_dataset(dataset, model, info);

  const max_adjustment_iterations = 20;
  const adjustment_delta = 2;
  return adjust_scores(
      dataset, text_length, adjustment_delta, max_adjustment_iterations,
      neutral_score, minimum_content_threshold);
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

// TODO: returning a function is silly. if someone wants to use the default
// scoring function they just reference it, there is need to generate

// Returns a model evaluation function that operates on a row of a block dataset
export function create_model() {
  return function evaluator(block, info) {
    const token_weights = {
      account: -10,
      ad: -50,
      ads: -50,
      advert: -50,
      advertisement: -50,
      article: 30,
      author: -10,
      bio: -20,
      body: 20,
      bottom: -10,
      branding: -10,
      breadcrumbs: -10,
      carousel: -10,
      cit: 10,  // citation abbreviation
      citation: 10,
      cmt: -10,
      col: -2,
      colm: -2,  // column abbreviation
      comment: -40,
      comments: -50,
      contact: -10,
      content: 20,
      contentpane: 50,
      cookie: -10,
      copyright: -10,
      credit: -2,
      date: -10,
      details: -20,
      disqus: -40,
      dsq: -30,  // disqus abbreviation
      entry: 10,
      fb: -5,  // facebook
      figure: 10,
      fixture: -5,
      footer: -40,
      furniture: -5,
      gutter: -30,
      header: -10,
      headline: -5,
      keywords: -10,
      left: -20,
      links: -10,
      list: -10,
      login: -30,
      main: 30,
      meta: -30,
      metadata: -10,
      mini: -5,
      more: -15,
      nav: -30,
      navbar: -30,
      navigation: -20,
      newsarticle: 50,
      newsletter: -20,
      page: 10,
      popular: -30,
      post: 20,
      primary: 10,
      promo: -50,
      promotion: -50,
      rail: -50,
      recirculation: -20,
      recommend: -10,
      recommended: -10,
      ref: 5,
      reference: 25,
      register: -30,
      rel: -50,
      relate: -50,
      related: -50,
      right: -50,
      rightcolumn: -20,
      secondary: -20,
      share: -20,
      side: -5,
      sidebar: -20,
      sign: -10,
      signup: -30,
      skip: -5,
      social: -30,
      splash: -10,
      sticky: -10,
      story: 50,
      storytxt: 50,
      stub: -10,
      subscribe: -30,
      subscription: -20,
      survey: -10,
      tag: -15,
      tags: -20,
      tease: -20,
      teaser: -20,
      thread: -10,
      tool: -30,
      tools: -30,
      top: -10,
      trend: -5,
      trending: -10,
      utility: -10,
      widget: -20,
      zone: -20
    };

    const type_bias_map = {
      article: 20,
      blockquote: 5,
      section: 0,
      layer: 0,
      cite: 10,
      code: 10,
      div: 0,
      dl: 0,
      td: 0,
      table: 0,
      header: -10,
      figure: 5,
      footer: -10,
      ul: 0,
      aside: -5,
      nav: -20,
      menu: -20,
      menuitem: 0,
      ol: 0,
      pre: 5,
    };

    let score = neutral_score;
    score += derive_depth_bias(block.depth);
    score += derive_element_type_bias(block.element_type, type_bias_map);
    score += derive_text_length_bias(block.text_length, info.text_length);
    score += derive_line_count_bias(block.text_length, block.line_count);
    score +=
        derive_anchor_density_bias(block.anchor_text_length, block.text_length);
    score += derive_list_bias(block.element, block.list_item_count);
    score += derive_paragraph_bias(block.paragraph_count);
    score += derive_field_bias(block.field_count);
    score += derive_image_bias(block.image_area, info.area);
    score +=
        derive_position_bias(block.element_index, info.front_max, info.end_min);
    score += derive_attribute_bias(block.attribute_tokens, token_weights);

    return Math.max(0, Math.min(score, 100));
  };
}

export function find_block_element(document, block) {
  // For now, cheat
  // TODO: maybe use something like element index
  assert(block.element);
  assert(block.element.ownerDocument === document);
  return block.element;
}

// Calculates a bias that should increase or decrease an element's boilerplate
// score based on the element's depth. The general heuristic is that the deeper
// the node, the greater the probability it is boilerplate. There is no risk
// of the document element or the body element from being scored because
// analysis starts from within body, so depth values 0 and 1 are grouped into
// the first bin and do not get any explicit treatment.
function derive_depth_bias(depth) {
  // NOTE: the coefficient used here was chosen empirically, need to do actual
  // analysis using something like linear regression, i am not even sure depth
  // is a great independent variable, this is also why i capped it to limit its
  // impact
  const slope = -4;
  let bias = slope * depth + 10;
  bias = Math.max(-5, Math.min(5, bias));
  return bias;
}

// Calculate a bias for an element's score based on the amount of text it
// contains relative to the overall amount of text in the document. Generally,
// large blocks of text are not boilerplate.
function derive_text_length_bias(block_text_length, document_text_length) {
  if (!document_text_length) {
    return 0;
  }

  if (!block_text_length) {
    return 0;
  }

  const ratio = block_text_length / document_text_length;

  // should be a param
  const max_text_bias = 5;

  let bias = 500 * ratio;
  bias = Math.min(max_text_bias, bias);

  return bias | 0;
}

// Text with lots of lines and a short amount of text per line is probably
// boilerplate, whereas text with lots of text per line are probably content.
function derive_line_count_bias(text_length, line_count) {
  // Calculate the typical text length of the lines of the block
  // TODO: the rounding can occur on the bias value after applying the
  // coefficient, we don't need to round lines here
  const line_length = (text_length / (line_count || 1)) | 0;

  // TODO: use a coefficient instead
  if (line_length > 100) {
    return 5;
  } else if (line_length > 50) {
    return 0;
  } else if (line_length > 20) {
    return -1;
  } else if (line_length > 1) {
    return -5;
  } else {
    return 0;
  }
}

// Assumes that anchors are not blocks themselves
function derive_anchor_density_bias(anchor_text_length, text_length) {
  const ratio = anchor_text_length / (text_length || 1);

  // TODO: use a coefficient and round instead of bin
  if (ratio > 0.9) {
    return -40;
  } else if (ratio > 0.5) {
    return -20;
  } else if (ratio > 0.25) {
    return -5;
  } else {
    return 0;
  }
}

function derive_element_type_bias(element_type, weights) {
  const bias = weights[element_type];
  return bias ? bias : 0;
}

function derive_paragraph_bias(paragraph_count) {
  return Math.min(20, paragraph_count * 5);
}

function derive_image_bias(image_area, doc_area) {
  return Math.min(70, (70 * image_area / doc_area) | 0);
}

function derive_position_bias(index, front_max, end_min) {
  // If the element is located near the start or the end then penalize it
  if (index < front_max || index > end_min) {
    return -5;
  }
  return 0;
}

function derive_field_bias(field_count) {
  return field_count > 0 && field_count < 10 ? -10 : 0;
}

// TODO: this should not depend on element, somehow, maybe use a block_type
// that is a category of tags (e.g. list, container). This should only depend
// on features. Even if I just add an 'is-list' feature, that is an improvement
function derive_list_bias(element, list_item_count) {
  // Do not punish lists themselves
  if (['ol', 'ul', 'dl'].includes(element.localName)) {
    return 0;
  }

  return Math.max(-5, -1 * list_item_count);
}

// Look at the values of attributes of a block element to indicate whether a
// block represents boilerplate
function derive_attribute_bias(tokens, token_weights) {
  let bias = 0;
  for (const token of tokens) {
    bias += token_weights[token] || 0;
  }
  return bias;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion error');
  }
}
