// Module for classifying html content as boilerplate

// Map of element names to bias values. This heavily penalizes certain elements
// that are indications of navigation or non-content, and remains relatively
// neutral or timid on other types. I include neutrals in the map to be explicit
// about them, even though they produce the equivalent non-bias, because I
// prefer to have the opinion be encoded clearly. We only care about
// container-type elements, as in, those elements which may contain other
// elements, that semantically tend to represent a unit or block of content that
// should be treated as a whole. We do not care about void elements or elements
// that contain only text (generally). This should generally align with the
// container-element-names array, but exact alignment is not important.
const type_bias_map = {
  article: 10,
  blockquote: 5,
  section: 0,
  layer: 0,
  code: 10,
  div: 0,
  dl: 0,
  td: 0,
  table: 0,
  header: -10,
  footer: -10,
  ul: 0,
  aside: -5,
  nav: -20,
  menu: -20,
  menuitem: 0,
  ol: 0,
  pre: 5,
};

const element_type_block_type_map = {
  article: 'content_container',
  blockquote: 'container',
  section: 'container',
  layer: 'container',
  code: 'content_container',
  div: 'container',
  dl: 'list',
  td: 'table',
  table: 'table',
  header: 'meta_container',
  footer: 'meta_container',
  ul: 'list',
  aside: 'side_container',
  nav: 'navigation',
  menu: 'navigation',
  ol: 'list',
  pre: 'content_container',
};

// The typical dimensions of a document
const default_document_area = 1500 * 2000;

// The percentage of content that must remain after boilerplate analysis.
const default_minimum_content_threshold = 0.2;

// TODO: block-element-names is redundant with the type bias map, maybe the two
// should be merged somehow

// Names of elements that tend to represent distinguishable areas of content.
// These blocks are generally what will be individually retained or removed
// when later filtering content.
//
// This includes td even though table includes td, because of how tables are
// sometimes used for a layout purpose instead of a semantic purpose.
//
// This does not include paragraphs or header-levels. Paragraphs are not
// isolated blocks which means that the algorithm does not try to analyze or
// filter certain paragraphs.
//
// This generally does not include inline-block elements (e.g. span, a).
const block_element_names = [
  'article', 'aside',  'blockquote', 'code',    'div',  'dl',
  'figure',  'footer', 'header',     'layer',   'main', 'mainmenu',
  'menu',    'nav',    'ol',         'picture', 'pre',  'section',
  'table',   'td',     'tr',         'ul'
];


// Blocks are scored on a scale of [0..100]. I've chosen this range over using
// negative scores to keep it simple and to treat scores as unsigned. A score
// is similar to a probability of boilerplate. A score of 0 means that we are
// confident a block is content, and a score of 100 means we are confident a
// block is boilerplate. A score of 50 means we are unsure.
export const neutral_score = 50;

// Marks up some of the elements of a document based on whether the elements are
// boilerplate. There are several attributes added to various elements, along
// with a key attribute named "boilerplate" that ultimately indicates whether
// or not the element contains boilerplate.
//
// Boilerplate elements may contain non-boilerplate, and non-boilerplate
// elements may contain boilerplate. Be way of naively pruning all elements
// classified as boilerplate.
//
// This assumes that images have known dimensions (that image.width and
// image.height are not 0). It will not error if the dimensions are missing, but
// it will not consider images in that case.
//
// Ideally this would produce a new document, but instead this mutates the input
// document, because cloning the input is cost-prohibitive.
//
// This does not do any actual pruning of the dom. Instead, this tags elements
// as likely boilerplate, as an intermediate step, so that a later step can
// revist the document and decide how it wants to prune. This splitting up of
// annotation (scoring) and pruning helps keep the algorithm easy to test and
// keeps it easy to analyze classification errors.
//
// @param document {Document} an html document, preferably inert
// @param model {Function} a scoring function
// @param options {Object} optional
// @option tail-size {Number} optional, should be between 0 and 0.5. The
// algorithm divides the document into sections of start, middle, and end.
// The tail size is the approximate size of each of the start and end sections,
// e.g. a tail size of 0.2 means that the start section is about 20% of the
// content, and the end section is about 20% of the content, leaving 60% of the
// content in the middle. Content in the tails is more likely to be boilerplate,
// so increasing tail size will tend to increase the amount of boilerplate
// found.
// @option document_area {Number} optional, defaults to the default
// constant defined in this module, used to approximate the area of a typical
// desktop screen. This assumes that any given document is generally viewed full
// screen. This is used to estimate the proportional area of a block based
// on any images it contains.
export function classify(document, evaluate_model, options = {}) {
  assert(typeof document === 'object');
  assert(typeof evaluate_model === 'function');

  const tail_size = isNaN(options.tail_size) ? 0.2 : options.tail_size;
  assert(!isNaN(tail_size));
  assert(tail_size >= 0 && tail_size < 0.5);

  const document_area = isNaN(options.document_area) ? default_document_area :
                                                       options.document_area;
  assert(!isNaN(document_area));
  assert(document_area >= 0);

  const minimum_content_threshold = isNaN(options.minimum_content_threshold) ?
      default_minimum_content_threshold :
      options.minimum_content_threshold;

  if (!document.body) {
    return [];
  }

  const document_text_length = get_text_length(document.body.textContent);
  if (!document_text_length) {
    return [];
  }

  // Query for all elements. Using getElementsByTagName because I assume it is
  // faster than querySelectorAll. Also not obvious is that I am using
  // getElementsByTagName to indicate that no mutation will occur, because I
  // almost always use querySelectorAll to allow for easier mutation during
  // iteration.
  const elements = document.body.getElementsByTagName('*');
  const num_elements = elements.length;

  // Find the cutoff indices into the all-elements array between start-middle
  // and between middle-end. Do this once here because it is loop invariant.
  const front_max = (tail_size * num_elements) | 0;
  const end_min = num_elements - front_max;

  // If the thresholds somehow overlap there is a programmer error
  if (end_min < front_max) {
    throw new Error('Calculated invalid cutoff indices');
  }

  // TODO: this is the wrong grouping, front_max and end_min are options,
  // not metadata, area is an option, and text_length is the only data point
  // Maybe text_length should be a per block property despite being redundant
  const info = {
    text_length: document_text_length,
    front_max: front_max,
    end_min: end_min,
    area: document_area
  };

  // Step 1: represent the document as a dataset
  // TODO: create_block_dataset should operate on the document itself
  const dataset = create_block_dataset(elements);

  // Step 2: extract features from each element in the dataset
  for (const block of dataset) {
    block.element_type = block.element.localName;
    block.depth = get_node_depth(block.element);
    block.text_length = get_text_length(block.element.textContent);

    // TODO: these helper functions should not rely on the block, just the
    // element, these should be generic DOM utility type functions
    block.line_count = get_line_count(block);
    block.anchor_text_length = get_anchor_text_length(block);
    block.image_area = get_block_image_area(block);
    block.attribute_tokens = get_block_attribute_tokens(block);
  }

  // Step 3: evaluate the model and save its properties
  // TODO: the model should actually just be a single scoring function
  for (const block of dataset) {
    block.score = evaluate_model(block, info);
  }

  // Step 4: adjust the classification scores to avoid too much boilerplate
  ensure_minimum_content(dataset, info, minimum_content_threshold);

  return dataset;
}

// Given a scored dataset representing a document, annotate the document
export function annotate_document(document, dataset) {
  for (const block of dataset) {
    if (isNaN(block.score)) {
      console.warn('block score is nan', JSON.stringify(block));
    }

    const element = find_block_element(document, block);
    element.setAttribute('score', block.score);

    if (block.score > 74) {
      element.setAttribute('boilerplate', 'lowest');
    } else if (block.score > 49) {
      // this includes neutral 50s too
      element.setAttribute('boilerplate', 'low');
    } else if (block.score > 24) {
      element.setAttribute('boilerplate', 'high');
    } else {
      element.setAttribute('boilerplate', 'highest');
    }
  }
}

function create_block_dataset(elements) {
  return Array.prototype.reduce.call(elements, reduce_element_to_block, []);
}

// Returns a model evaluation function that operates on a dataset, which in this
// case is an array of Block objects. Also the model is hardcoded for now.
export function create_model() {
  return function evaluator(block, document_info) {
    // TODO: nothing should depend directly on block.element
    // TODO: finish converting bias functions to rely on extracted features
    // instead of doing feature extraction within the functions themselves
    // TODO: this shouldn't actually modify the block in any way whatsoever, so
    // I need to think about how to get out the debugging information in another
    // way.

    let score = neutral_score;
    score += derive_depth_bias(block.depth);
    score += derive_element_type_bias(block);
    score += derive_text_length_bias(block, document_info);
    score += derive_line_count_bias(block);
    score += derive_anchor_density_bias(block);

    // TODO: these functions should not be able to rely on element at this point
    score += derive_list_bias(block.element);
    score += derive_paragraph_bias(block.element);
    score += derive_form_bias(block.element);
    score += derive_image_bias(block, document_info.area);
    score += derive_position_bias(
        block.element, block.element_index, document_info.front_max,
        document_info.end_min);
    score += derive_attribute_bias(block);
    return Math.max(0, Math.min(score, 100));
  };
}

// An element's score indicates whether it is boilerplate. A higher score means
// less likely to be boilerplate.
function ensure_minimum_content(
    blocks, document_info, minimum_content_threshold) {
  if (!document_info.text_length) {
    return;
  }

  if (!blocks.length) {
    return;
  }

  // This is about how far we are willing to go before giving up on promoting
  // boilerplate into content (given score adjustment by 1% at a time).
  const max_iterations = 20;
  let iterations = 0;

  // Loop over the blocks, uniformly incrementing boilerplate block scores a bit
  // each iteration, until we reach the minimum content threshold or give up
  // after a number of iterations.
  let content_text_length = get_content_length(blocks);
  let ratio = content_text_length / document_info.text_length;
  while (ratio < minimum_content_threshold && iterations < max_iterations) {
    // Slightly adjust all boilerplate blocks. We do not favor any particular
    // block, everything gets a bump.
    for (const block of blocks) {
      if (block.score < neutral_score) {
        block.score += 1;
      }
    }

    content_text_length = get_content_length(blocks);
    ratio = content_text_length / document_info.text_length;
    iterations++;
  }

  // TEMP: debugging
  if (iterations > 0) {
    console.debug('Iteration count for adjustment', iterations);
  }
}

// Get the total text length of all non-boilerplate blocks
function get_content_length(blocks) {
  let length = 0;
  for (const block of blocks) {
    // > neutral is content, = neutral is content, < neutral is boilerplate
    if (block.score >= neutral_score) {
      length += block.text_length;
    }
  }
  return length;
}

function reduce_element_to_block(blocks, element, index) {
  if (block_element_names.includes(element.localName)) {
    blocks.push(new Block(element, index));
  }
  return blocks;
}

// A block is a representation of a portion of a document's content along with
// some derived properties.
function Block(element, element_index = -1) {
  // A live reference to the node in the full document. Each block tracks its
  // represented root element to allow for deferring processing that depends
  // on the element into later iterations over the live dom.
  this.element = element;

  // index into all elements array. This is a representation of the position
  // of the block within the content. -1 means not set or invalid index.
  this.element_index = element_index;

  // The element's type (e.g. the tagname), all lowercase, not qualified. This
  // is redundant with the live reference, but the live reference only exists
  // for performance sake. This is the extracted feature out of the reference.
  // The caller is responsible for ensuring correspondence to the element
  // property.
  // TODO: instead of the actual element name, I could use this to aggregate
  // element types together into block types, and have block types such as
  // 'container' or 'list', where it does not matter if the block is div/ul/ol
  // or whatever anymore, just its more abstract type. Code that requires the
  // element name can still dig into the element reference, but other code that
  // relies on element type can just compare at the more abstract level. Another
  // benefit is that the type-bias method would do a lookup within a smaller
  // map. Another benefit is that it feels less wonky to have the bias-map be
  // separate from the block-element-names array.
  this.element_type = undefined;

  // The number of node hops (edge traversals or path length) to the root
  // node (not the body node!). -1 means invalid or not set.
  this.depth = -1;

  // A representation of the count of characters within the element. This is
  // roughly equivalent to the total length of the text nodes within the element
  // or any of its descendants. -1 is an invalid length.
  this.text_length = -1;

  // A representation of the number of lines of content within the block. This
  // does not necessarily correspond to a simple count of '\n' characters. This
  // is more of an approximation of how many flow-breaks there are within this
  // block of content. Many things within the block content can cause a
  // flow-break, such as the presence of a p tag, or an h1 tag, a new table row,
  // etc.
  this.line_count = 0;

  // An approximation of the size of this element based on the size of the
  // images contained within the element or its descendants.
  this.image_area = 0;

  // A set of strings pulled from the block element's own html attributes, such
  // as element id or class. NOTE: this is not yet fully implemented
  this.attribute_tokens = [];

  // The block's content score. All blocks are initially neutral. The lower the
  // score the more likely the content is boilerplate. Score is clamped within
  // the range [0..100].
  this.score = neutral_score;

  // Biases
  this.depth_bias = 0;
  this.type_bias = 0;
  this.text_bias = 0;
  this.line_count_bias = 0;
  this.anchor_density_bias = 0;
  this.list_bias = 0;
  this.paragraph_bias = 0;
  this.form_bias = 0;
  this.image_bias = 0;
  this.position_bias = 0;
  this.attribute_bias = 0;
}

export function find_block_element(document, block) {
  // For now, cheat
  assert(block.element);
  assert(block.element.ownerDocument === document);
  return block.element;
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

// TODO: change to be specific to DOM elements, not specific to blocks, because
// this is a general purpose function for dom interaction that we happen to use
// in a particular way, this is more like an adaptation of the
// getComputedStyle.bounds technique
// TODO: consider generalizing to all media, such as video and audio components,
// and not just images.
// TODO: consider using a default width and default height of all images, that
// when dimensions are unknown, the defaults are used, so it does not matter as
// much if document is inert (e.g. from XMLHttpRequest or DOMParser)
// This is a conservative approach to calculating total area from descendant
// images. This assumes that images within the element have explicit width and
// height attributes, and therefore have initialized width and height
// properties.
function get_block_image_area(block) {
  const images = block.element.getElementsByTagName('img');
  let area = 0;
  for (const image of images) {
    area += image.width * image.height;
  }
  return area;
}

function get_block_attribute_tokens(block) {
  // Not yet implemented, see the todos for derive_attribute_bias

  // TODO: this should produce a distinct set, not just the full set
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
function derive_text_length_bias(block, info) {
  const document_text_length = info.text_length;
  if (!document_text_length) {
    return 0;
  }

  if (!block.text_length) {
    return 0;
  }

  const ratio = block.text_length / document_text_length;

  const max_text_bias = 5;

  // Calc bias
  let bias = (100 * ratio * max_text_bias) | 0;
  // Cap influence to max
  bias = Math.min(max_text_bias, bias);

  return bias;
}

function derive_line_count_bias(block) {
  if (!block.text_length) {
    return 0;
  }

  // Ignore text that is basically too small. The line count heuristic probably
  // is not worth that much in this case. The inference is too tenuous.
  if (block.line_count < 3) {
    return 0;
  }

  const text_per_line = (block.text_length / block.line_count) | 0;

  // TEMP: debugging
  // console.debug(block.text_length, block.line_count, text_per_line);
  // block.element.setAttribute('text-per-line', text_per_line);

  // Text with lots of lines and a short amount of text per line is probably
  // boilerplate, whereas text with lots of text per line are probably content.
  if (text_per_line > 100) {
    return 5;
  } else if (text_per_line > 50) {
    return 0;
  } else if (text_per_line > 20) {
    return -1;
  } else if (text_per_line > 1) {
    return -5;
  } else {
    return 0;
  }
}

// Assumes that anchors are not blocks themselves
function derive_anchor_density_bias(block) {
  const ratio = block.anchor_text_length / (block.text_length || 1);

  // TODO: instead of binning, use a coefficient

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

function get_text_length(text) {
  // Exclude trailing whitespace entirely. This effectively excludes common
  // text nodes such as '\t\n' from contributing to length.
  const trimmed_text = text.trim();
  // Condense inner whitespace
  const condensed_text = trimmed_text.replace(/\s{2,}/g, ' ');
  return condensed_text.length;
}

function derive_element_type_bias(block) {
  const bias = type_bias_map[block.element_type];
  return bias ? bias : 0;
}

function derive_paragraph_bias(element) {
  // TODO: this should be done during feature extraction
  let pcount = 0;
  for (let child = element.firstElementChild; child;
       child = child.nextElementSibling) {
    if (child.localName === 'p') {
      pcount++;
    }
  }

  let bias = pcount * 5;
  bias = Math.min(20, bias);
  return bias;
}

function derive_image_bias(block, doc_area) {
  return Math.min(70, (70 * block.image_area / doc_area) | 0);
}

function derive_position_bias(element, index, front_max, end_min) {
  // If the element is located near the start or the end then penalize it
  if (index < front_max || index > end_min) {
    return -5;
  }
  return 0;
}

function derive_form_bias(element) {
  const fields =
      element.querySelectorAll('form, input, select, button, textarea');

  if (fields.length > 10) {
    return 0;
  } else if (fields.length > 0) {
    return -10;
  } else {
    return 0;
  }
}


// TODO: this incorrectly penalizes certain lists, for example see
// https://theoutline.com/post/5208/eating-gummies-is-not-a-substitute-for-wearing-sunscreen
// Maybe this should be excluding ol/ul/dl themselves from being analyzed, and
// doing something like comparing it to neighboring text length. boilerplate
// tends to have very little text outside of the list, but in-main-content-area
// lists tend to have a lot of surrounding text. also note in the example page
// that the list in question does not have any links. Using -1 might be
// overkill.
function derive_list_bias(element) {
  const items = element.querySelectorAll('li, dd, dt');
  let bias = -1 * items.length;
  bias = Math.max(-10, bias);
  return bias;
}

// TODO: use block.attribute_tokens instead. attribute_tokens should represent
// the set, that means i need to change the loop in derive_attribute_bias, and
// use two loops, one loop that creates the set and ensures uniqueness, then
// the second loop that iterates over the set and calcs bias. This function
// should work off the set (as an array).

// Look at the values of attributes of a block element to indicate whether a
// block represents boilerplate
function derive_attribute_bias(block) {
  // TODO: accessing attribute values by property appears to be a tiny bit
  // faster, but I am not sure if it is worth it. Should probably just revert to
  // using getAttribute in a uniform manner

  const vals = [
    block.element.id, block.element.name, block.element.className,
    block.element.getAttribute('itemprop')
  ];

  // It is not obvious, so note that join implicitly filters undefined values so
  // no need to explicitly check
  const joined_vals = vals.join(' ');

  // If the overall text length is small, then probably do not worth doing
  // token analysis
  if (joined_vals.length < 3) {
    return 0;
  }

  // It is faster to use one lowercase call on the entire string than
  // calling lowercase on each token separately

  // TODO: also need to split on camelcase, like in the string "appendedAds",
  // I would prefer to get two tokens "appended" and "ads". This means the
  // current approach of lowercase-all will not suffice, and the current
  // tokenize algorithm will not suffice.

  const tokens = tokenize(joined_vals.toLowerCase());
  const token_set = [];

  // Inexact, just an upper bound to try and reduce calls
  // TODO: this should be a parameter to function, and treated as constant
  const max_token_len = 15;

  let bias = 0;
  for (const token of tokens) {
    if (token && token.length < max_token_len && !token_set.includes(token)) {
      token_set.push(token);
      const token_bias = token_weights[token];
      if (token_bias) {
        bias += token_bias;
      }
    }
  }

  return bias;
}

// TODO: add support for camel-case splitting
// TODO: see https://stackoverflow.com/questions/18379254
// see https://stackoverflow.com/questions/7593969
function tokenize(value) {
  return value.split(/[\s\-_0-9]+/g);
}

// Find the count of characters in anchors that are anywhere in the
// descendant hierarchy of this element. This assumes anchors do not contain
// each other (e.g. not misnested).
function get_anchor_text_length(block) {
  const element = block.element;
  const anchors = element.querySelectorAll('a[href]');
  let anchor_length = 0;
  for (const anchor of anchors) {
    const text_length = get_text_length(anchor.textContent);
    anchor_length += text_length;
  }
  return anchor_length;
}

// Returns an approximate count of the number of lines in a block of text
function get_line_count(block) {
  if (!block.text_length) {
    return 1;
  }

  // Use the number of descendant flow-breaking elements as an estimate of
  // line length.

  // The presence of these elements within an element's descendant hierarchy
  // is a rough indication of content spanning over a new line.
  //
  // These do not necessarily correspond to block elements.
  //
  // This array is defined per call, but it is const, and I assume v8 is smart
  // enough to hoist this invariant if this function gets hot. I think the
  // proper style is to define a variable as local as possible without regard
  // for optimization. I am still a bit wary of this.
  //
  // TODO: make this more exhaustive, look for typical flow-breaking elements,
  // maybe consider any other container-type block. In fact maybe instead of
  // line count I should be looking at text-to-child-blocks ratio. Maybe also
  // include some of the other block elements as flow-breaking.
  const line_splitter_element_names = [
    'br', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li',
    'menuitem', 'p', 'tr'
  ];

  const selector = line_splitter_element_names.join(',');
  const elements = block.element.querySelectorAll(line_splitter_element_names);
  let line_count = elements.length;

  // Special handling for preformatted text
  let newline_count = 0;
  if (['pre', 'code'].includes(block.element_type)) {
    const lines = block.element.textContent.split('\n');
    newline_count = lines.length;
  }
  line_count += newline_count;

  // Always count the first line as a line
  if (line_count === 0) {
    line_count = 1;
  }

  return line_count;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion error');
  }
}

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
  carousel: -10,
  cmt: -10,
  col: -2,
  colm: -2,  // alternate abbr for column
  comment: -40,
  contact: -10,
  content: 20,
  contentpane: 50,
  copyright: -10,
  credit: -2,
  date: -10,
  details: -20,
  disqus: -40,
  dsq: -30,  // disqus abbreviation
  entry: 10,
  fb: -5,  // facebook
  fixture: -5,
  footer: -20,
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
  post: 5,
  primary: 10,
  promo: -50,
  promotion: -50,
  rail: -50,
  recirculation: -20,
  recommend: -10,
  recommended: -10,
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
  social: -30,
  splash: -10,
  story: 50,
  storytxt: 50,
  stub: -10,
  subscription: -20,
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

// TODO: if an image is large enough, it should be considered a block of its
// own, and all the block handlers should have special treatment for image
// blocks, and image (or maybe picture/figure?) should also be considered as
// independent blocks. Right now things tend to work because images are almost
// always in a separate container, but sometiems it doesn't work. The main
// problem is some of the important content-images that appear in the large
// article body get flagged as sub-boilerplate because they tend to be in a
// block that has a couple links or other negative features that outweight the
// image bias itself. At the same time this is problematic with respect to the
// idea that boilerplate blocks apply to all descendants, if the ancestor thinks
// it is boilerplate the image score doesn't matter. in fact right now all
// iamges are non-boilerplate. so really need to fix image ancestor score. maybe
// the anchor density bias needs to take into account image size.

// TODO: think about image-in-list stuff, such as related-posts sections
// I think the reasoning here is that if an element looks like it occupies
// a large amount of screen space, it probably is not boilerplate. Boilerplate
// tends to be small. But it is hard to penalize small images accurately. So
// look for large images and do a reward.
// TODO: be less naive about hidden images in a carousel, this sums area from
// all of them at the moment, i think, in some cases, unless those hidden ones
// are first filtered out, this leads to erroneously large area
// TODO: maybe image bias should look at ratio to text too, like a total area to
// text length ratio, a kind of nonsensical value, but it could be used in
// general to say that a portion of the content is almost entirely images and no
// text and maybe that says something about boilerplate?

// TODO: target known asides more directly: social, related, featured,
// copyright, menu, advertisement, read more, newsletter signup, site search
// TODO: reward footnotes
// TODO: proximity spreading bias, e.g. content near good content rewarded?
// what about an intermediate ad?

// TODO: I could separate out the model stuff into a separate thing, then
// this takes a model and a document and scores the document using the model,
// but for now I am going to do it all at once.

// TODO: increase list penalty, look at the amount of text within a list vs
// text not in a list
// TODO: slightly penalize any block containing list, or look at ratio of
// text outside of list to text in list

// TODO: counteract list penalty leading to removal of table of contents content
// by rewarding table of contents lists by looking for '#' in anchor url and
// same page url (would need document-url as another parameter, and would need
// to always canonicalize-urls before or access by src property and expect
// base-uri to be set (imply that document is embeddable/standalone))
// TODO: also promote lists without any anchors

// TODO: penalize all next-siblings of footer elements, and all prev siblings
// of header elements

// TODO: instead of just ensuring minimum content length, what about another
// pass that finds the highest scoring block, then ensures its ancestors all the
// way up to the root node are not boilerplate by adjusting their scores higher?
// or we could sort blocks by score, take the highest 3 blocks, then ensure
// those are visible
