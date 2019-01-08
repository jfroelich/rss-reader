import assert from '/src/assert.js';

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
    text_length = get_text_length(document.body.textContent);
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

// TODO: score should not be a built in property. a block is only concerned with
// representing the parsed featured of a block, not its derived features,
// whether those derived features are variables for later heuristics or the
// final classification. this also means that initial score should not be a
// parameter.

// A block is a representation of a portion of a document's content along with
// some derived properties.
//
// @param element {Element} a live reference to the element in a document that
// this block represents
// @param element_index {Number} the index of the block in the all-body-elements
// array
export function Block(element, initial_score = 0, element_index = -1) {
  this.element = element;
  this.element_index = element_index;
  this.parent_block_index = -1;
  this.element_type = undefined;
  this.depth = -1;
  this.text_length = -1;
  this.line_count = 0;
  this.image_area = 0;
  this.list_item_count = 0;
  this.paragraph_count = 0;
  this.field_count = 0;
  this.attribute_tokens = [];

  this.score = initial_score;
}

// Blocks are distinguishable areas of content
// NOTE: lists (ol/ul/dl) excluded at the moment due to bad scoring
// TODO: i need to somehow reintroduce support for treating lists as
// distinguishable blocks. For example, <ul old-id="breadcrumbs"></ul> is a
// standalone section of content that should be removable
// NOTE: <code> excluded at the moment, maybe permanently

// TODO: I would prefer that neutral_score not be a parameter. but right now
// it is needed to properly initialize blocks. so i need to change block
// constructor first then remove it here.

// Given a document, produce an array of blocks
export function parse_blocks(document, neutral_score) {
  if (!document.body) {
    return [];
  }

  const block_element_names = [
    'article', 'aside', 'blockquote', 'div', 'figure', 'footer', 'header',
    'layer', 'main', 'mainmenu', 'menu', 'nav', 'picture', 'pre', 'section',
    'table', 'td', 'tr'
  ];

  // NOTE: while it is tempting to use a selector that traverses only those
  // elements that are block candidates, this would deny us from tracking the
  // proper index into a collection of all dom elements. We need to track the
  // all-elements index so that we can find which element corresponds to which
  // block later (if and once I remove the element property from a block).

  const elements = document.body.getElementsByTagName('*');
  const blocks = [];
  for (let element_index = 0, len = elements.length; element_index < len;
       element_index++) {
    const element = elements[element_index];
    if (block_element_names.includes(element.localName)) {
      const block = new Block(element, neutral_score, element_index);
      find_and_set_parent(blocks, block, element);
      blocks.push(block);
    }
  }

  return blocks;
}

// TODO: this should be composable, like find-parent + set-parent-prop, not this
// compound verb
function find_and_set_parent(blocks, block, element) {
  // We walk backwards because the parent is most likely to be the preceding
  // block (the last block in the array) at the time this is called.

  for (let index = blocks.length - 1; index > -1; index--) {
    if (blocks[index].element.contains(element)) {
      block.parent_block_index = index;
      break;
    }
  }
}


// This module focuses on setting derived properties of blocks in the dataset
// by analyzing the content of each block.
//
// This is a package-private module only intended for use by boilerplate.js or
// testing. This is re-exported by boilerplate.js, so access it from there.

// TODO: maybe specifying the Block type was bad, I should simply use a generic
// dictionary

// TODO: the main export is public facing, so it would be appropriate to use
// an assertion or two to check against bad parameters (TypeErrors).

// TODO: for now this will directly set pre-existing properties of block
// objects. However that may be the wrong coupling. It could be better if the
// block object format has no apriori knowledge of which features will be added.
// That was the format does not need to change as new features are developed and
// as old featuers are removed. It might also improve how features are then
// later inspected, because the inspector already possesses the expectation that
// some features may be missing. By having 'features' be a bag properties this
// seems to fall more in line with that optional sense. So a block object should
// instead have a property called features, which points to another object.
// Then, this function should just be (1) lazily creating the features object,
// and (2) setting the properties of the features object. Furthermore, it will
// better delineate between block structure features (like the block index
// property), and misc derived heuristic features set here. However, before
// doing this change, I am first going to focus on refactoring the current
// implementation which is presently monolothic into more of a distributed
// monolith.

// TODO: the basic features like element_type should be done in the block
// generation algorithm, not as a part of feature extraction

// TODO: attribute tokens should maybe be grouped into buckets of bad/good,
// and as separate features like bad_token_count and good_token_count, and
// then some uniform weight is applied in the scoring section

// TODO: each feature extraction helper should maybe operate on the block,
// not the particular properties of the block, so block should be the parameter,
// this makes it easier to call the various extractor functions, makes it eaiser
// to thoughtlessly add new ones

// TODO: i think the helpers need to be better named, get implies simple prop
// access, these are doing calculation

// Options:
// max_token_length - the maximum number of characters per token when analyzing
// attribute tokens

export function extract_features(dataset, options = {}) {
  const max_token_length = options.max_token_length || 15;

  for (const block of dataset) {
    block.element_type = block.element.localName;
    block.depth = get_node_depth(block.element);
    block.text_length = get_text_length(block.element.textContent);
    block.anchor_text_length = get_anchor_text_length(block.element);
    block.list_item_count = get_list_item_count(block.element);
    block.paragraph_count = get_paragraph_count(block.element);
    block.field_count = get_field_count(block.element);
    block.line_count = get_line_count(block.element, block.text_length);
    block.image_area = get_descendant_image_area(block.element);
    block.attribute_tokens =
        get_attribute_tokens(block.element, max_token_length);
  }

  return dataset;
}

// Return the distance of the node to the owning document's root node.
function get_node_depth(node) {
  node = node.parentNode;
  let depth = 0;
  while (node) {
    node = node.parentNode;
    depth++;
  }
  return depth;
}

// Find the count of characters in anchors that are anywhere in the descendant
// hierarchy of this element. This assumes anchors do not contain each other
// (e.g. not misnested).
function get_anchor_text_length(element) {
  const anchors = element.querySelectorAll('a[href]');
  let anchor_length = 0;
  for (const anchor of anchors) {
    const text_length = get_text_length(anchor.textContent);
    anchor_length += text_length;
  }
  return anchor_length;
}

// Count the number of descendant list items
function get_list_item_count(element) {
  return element.querySelectorAll('li, dd, dt').length;
}

// Returns the approximate number of paragraphs in an element. This only looks
// at immediate children, not all descendants. This is naive because it is fast
// and I am not sure how useful it is to do all the extra work to make it more
// accurate. This logic is unrelated to the line counting logic. This logic
// currently ignores many things like double-line-break in preformatted text.
// TODO: rename to get_child_paragraph_count to make it even more obvious. Or
// consider estimate_child_paragraph_count, to make it even more obvious that it
// is (1) a derivation that involves calculation which is not just simple
// property access as is normally implied by the get qualifier and (2) that it
// is inexact.
// TODO: add support for preformatted text?
// TODO: ensure returning non-0? everything has at least one paragraph, right?
// see what i did for line counting.
// TODO: it is possible this should be a derivation of line counting instead of
// as a separate analysis.
// TODO: is this the best way to walk child elements?
// TODO: profile
// TODO: implement testing
function get_paragraph_count(element) {
  // We actually match multiple paragraph-like items, not just paragraph tags.
  // We are actually looking for all text-breaking features.
  const names = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

  let count = 0;
  for (let child = element.firstElementChild; child;
       child = child.nextElementSibling) {
    if (names.includes(child.localName)) {
      count++;
    }
  }
  return count;
}

// Returns an approximate count of the number of lines in a block of text
function get_line_count(element, text_length) {
  if (!text_length) {
    return 1;
  }

  const line_splitter_element_names = [
    'br', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li',
    'menuitem', 'p', 'tr'
  ];

  const selector = line_splitter_element_names.join(',');
  const elements = element.querySelectorAll(line_splitter_element_names);
  let line_count = elements.length;

  // Special handling for preformatted text
  let newline_count = 0;
  if (['pre', 'code'].includes(element.localName)) {
    const lines = element.textContent.split('\n');
    newline_count = lines.length;
  }
  line_count += newline_count;

  return line_count ? line_count : 1;
}

function get_field_count(element) {
  return element.querySelectorAll('input, select, button, textarea').length;
}

// Get the total area of all descendant images
function get_descendant_image_area(element) {
  const images = element.getElementsByTagName('img');
  let area = 0;
  for (const image of images) {
    area += image.width * image.height;
  }
  return area;
}

// Return a set of distinct lowercase tokens from some of the values of the
// element's attributes
function get_attribute_tokens(element, max_length) {
  const keys = ['id', 'name', 'class', 'itemprop', 'role'];
  const values = keys.map(key => element.getAttribute(key));
  const joined_values = values.join(' ');
  const normal_values = joined_values.toLowerCase();
  const tokens = tokenize(normal_values);
  const token_set = create_token_set(tokens);
  return max_length > 0 ? token_set.filter(t => t.length <= max_length) :
                          token_set;
}

function tokenize(value) {
  const values = value.split(/[\s\-_0-9]+/g);
  const non_empty_values = values.filter(v => v);
  return non_empty_values;
}

function create_token_set(tokens) {
  // We do not use a real Set here. Set is slow. It is faster to use a simple
  // array.

  const set = [];
  for (const token of tokens) {
    if (!set.includes(token)) {
      set.push(token);
    }
  }
  return set;
}

// TODO: score_block should not be a
// parameter to this function. the score function should basically be the one
// public method of a model instance.

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

export function score_block(block, info, neutral_score) {
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

  const min_score = 0;
  const max_score = 100;
  return Math.max(min_score, Math.min(score, max_score));
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

function derive_element_type_bias(element_type, weights) {
  const bias = weights[element_type];
  return bias ? bias : 0;
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
// TODO: use a coefficient instead instead of bin thresholds
function derive_line_count_bias(text_length, line_count) {
  // Calculate the typical text length of the lines of the block
  // TODO: the rounding can occur on the bias value after applying the
  // coefficient, we don't need to round lines here
  const line_length = (text_length / (line_count || 1)) | 0;

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

function derive_paragraph_bias(paragraph_count) {
  return Math.min(20, paragraph_count * 5);
}

function derive_field_bias(field_count) {
  return field_count > 0 && field_count < 10 ? -10 : 0;
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

// Look at the values of attributes of a block element to indicate whether a
// block represents boilerplate
function derive_attribute_bias(tokens, token_weights) {
  let bias = 0;
  for (const token of tokens) {
    bias += token_weights[token] || 0;
  }
  return bias;
}

// Return an approximate count of the characters in a string. This ignores outer
// whitespace excessive inner whitespace.
export function get_text_length(text) {
  const trimmed_text = text.trim();
  const condensed_text = trimmed_text.replace(/\s\s+/g, ' ');
  return condensed_text.length;
}
