export const neutral_score = 50;

// Given a dataset representing content sections of a document, produce a scored
// dataset indicating which elements in the dataset are boilerplate.
//
// @option tail_size {Number} optional, should be in range [0..0.5), determines
// what percentage of content blocks fall into header and footer sections
// @option document_area {Number} optional, the default dimensions of a document
// to use when determining the proportional size of content blocks
// @option minimum_content_threshold {Number} optional, should be in range
// 0-100, indicating minimum desired percentage of content vs. boilerplate
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

  // TODO: this is the wrong grouping, front_max and end_min are options,
  // not metadata, area is an option, and text_length is the only data point
  // Maybe text_length should be a per block property
  const info = {
    text_length: text_length,
    front_max: front_max,
    end_min: end_min,
    area: document_area
  };

  // TODO: the model should export a function named score. The function should
  // encapsulate this loop, along with the secondary ensure pass. This should
  // be calling that function here. Not doing this stuff explicitly in a calling
  // context. The score function should operate off a dataset of blocks, so it
  // should take a dataset as a parameter. Its individual per-block scoring
  // function should be an internal helper to that module.

  for (const block of dataset) {
    block.score = model(block, info);
  }

  ensure_minimum_content(dataset, text_length, minimum_content_threshold);
  return dataset;
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

// Given a document, produce a dataset suitable for analysis
// @param max_token_length the maximum number of characters per token when
// analyzing attribute tokens
export function create_block_dataset(document, max_token_length = 15) {
  if (!document.body) {
    return [];
  }

  // Distinguishable areas of content
  // NOTE: lists (ol/ul/dl) excluded at the moment due to bad scoring
  // NOTE: <code> excluded at the moment, maybe permanently

  const block_element_names = [
    'article', 'aside', 'blockquote', 'div', 'figure', 'footer', 'header',
    'layer', 'main', 'mainmenu', 'menu', 'nav', 'picture', 'pre', 'section',
    'table', 'td', 'tr'
  ];

  const elements = document.body.getElementsByTagName('*');
  const dataset = [];
  for (let element_index = 0, len = elements.length; element_index < len;
       element_index++) {
    const element = elements[element_index];
    if (block_element_names.includes(element.localName)) {
      const block = new Block(element, element_index);

      for (let block_index = dataset.length - 1; block_index > -1;
           block_index--) {
        if (dataset[block_index].element.contains(element)) {
          block.parent_block_index = block_index;
          break;
        }
      }

      dataset.push(block);
    }
  }

  // TODO: this functionality should be decoupled from the generation of the
  // dataset itself. This funcitonality should be implemented as a second pass
  // over the extracted blocks, as a part of a feature-extraction module.

  // TODO: attribute tokens should maybe be grouped into buckets of bad/good,
  // and as separate features like bad_token_count and good_token_count, and
  // then some uniform weight is applied in the scoring section

  // Extract features
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

// TODO: returning a function is silly. if someone wants to use the default
// scoring function they just reference it, there is need to generate

// An element's score indicates whether it is boilerplate. A higher score means
// less likely to be boilerplate.
function ensure_minimum_content(
    blocks, document_text_length, minimum_content_threshold) {
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
  let content_text_length = get_visible_content_length(blocks);
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
          'Unable to adjust scores further to meet threshold', ratio,
          minimum_content_threshold);

      break;
    }

    content_text_length = get_visible_content_length(blocks);
    ratio = content_text_length / document_text_length;
    iterations++;
  }
}

// Get the total text length of all non-boilerplate blocks. A block only
// contributes to visible length when the block itself is visible and all of its
// ancestors are visible.
function get_visible_content_length(blocks) {
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

// A block is a representation of a portion of a document's content along with
// some derived properties.
//
// @param element {Element} a live reference to the element in a document that
// this block represents
// @param element_index {Number} the index of the block in the all-body-elements
// array
function Block(element, element_index = -1) {
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

  this.score = neutral_score;
}

export function find_block_element(document, block) {
  // For now, cheat
  // TODO: maybe use something like element index
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

// Get the total area of all descendant images
function get_descendant_image_area(element) {
  const images = element.getElementsByTagName('img');
  let area = 0;
  for (const image of images) {
    area += image.width * image.height;
  }
  return area;
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

function get_text_length(text) {
  // Exclude trailing whitespace entirely. This effectively excludes common
  // text nodes such as '\t\n' from contributing to length.
  const trimmed_text = text.trim();
  // Condense inner whitespace. Note that I choose condense instead of just
  // completely ignoring whitespace, because to some extent the number of
  // intermediate spaces indicates the number of words, and therefore indicates
  // a longer amount of text.
  const condensed_text = trimmed_text.replace(/\s\s+/g, ' ');
  return condensed_text.length;
}

function derive_element_type_bias(element_type, weights) {
  const bias = weights[element_type];
  return bias ? bias : 0;
}

function derive_paragraph_bias(paragraph_count) {
  return Math.min(20, paragraph_count * 5);
}

// Counts child paragraphs (not all descendants!)
function get_paragraph_count(element) {
  // We actually match multiple paragraph-like items. We are actually looking
  // for text-breaking elements related to text.
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

function get_field_count(element) {
  return element.querySelectorAll('input, select, button, textarea').length;
}

// TODO: this should not depend on element, somehow, maybe use a block_type
// that is a category of tags (e.g. list, generic-container)
function derive_list_bias(element, list_item_count) {
  // Do not punish lists themselves
  if (['ol', 'ul', 'dl'].includes(element.localName)) {
    return 0;
  }

  return Math.max(-5, -1 * list_item_count);
}

// Count the number of descendant list items
function get_list_item_count(element) {
  return element.querySelectorAll('li, dd, dt').length;
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
  const set = [];
  for (const token of tokens) {
    if (!set.includes(token)) {
      set.push(token);
    }
  }
  return set;
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion error');
  }
}
