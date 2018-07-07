// Module for classifying html content as boilerplate

export const neutral_score = 50;

// Produce a scored dataset indicating which elements in the document are
// boilerplate.
//
// @option tail_size {Number} optional, should be in range [0..0.5), determines
// what percentage of content blocks fall into header and footer sections
// @option document_area {Number} optional, the default dimensions of a document
// to use when determining the proportional size of content blocks
// @option minimum_content_threshold {Number} optional, should be in range
// 0-100, indicating minimum desired percentage of content vs. boilerplate
export function classify(document, evaluate_model, options = {}) {
  assert(typeof document === 'object');
  assert(typeof evaluate_model === 'function');

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

  if (!document.body) {
    return [];
  }

  const document_text_length = get_text_length(document.body.textContent);
  if (!document_text_length) {
    return [];
  }

  // TODO: this calculation only belongs in evaluate_model, evaluate model
  // should accept a document parameter maybe?
  let num_elements = 0;
  if (document.body) {
    num_elements = document.body.getElementsByTagName('*').length;
  }

  // Find the cutoff indices into the all-elements array between start-middle
  // and between middle-end. Do this once here because it is loop invariant.
  const front_max = (tail_size * num_elements) | 0;
  const end_min = num_elements - front_max;

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
  // TODO: dataset should be a parameter to classify, the caller should have to
  // compose this call explicitly with the classify call
  const dataset = create_block_dataset(document);

  // Step 2: extract features from each element in the dataset
  for (const block of dataset) {
    block.element_type = block.element.localName;
    block.depth = get_node_depth(block.element);
    block.text_length = get_text_length(block.element.textContent);
    block.list_item_count = get_list_item_count(block.element);
    block.paragraph_count = get_paragraph_count(block.element);
    block.field_count = get_field_count(block.element);

    // TODO: these helper functions should not rely on the block, just the
    // element, these should be generic DOM utility type functions
    block.line_count = get_line_count(block);
    block.anchor_text_length = get_anchor_text_length(block);
    block.image_area = get_block_image_area(block);
    block.attribute_tokens = get_block_attribute_tokens(block);
  }

  // Step 3: evaluate the model against each dataset row
  for (const block of dataset) {
    block.score = evaluate_model(block, info);
  }

  // Step 4: adjust the classification scores to avoid too much boilerplate
  // TODO: the info object has some stamp coupling anti-pattern I think, if
  // there is only one property used then only pass that sole property instead
  // of the whole object
  ensure_minimum_content(dataset, info, minimum_content_threshold);

  // Expose the scored dataset
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

function create_block_dataset(document) {
  if (!document.body) {
    return [];
  }

  // Distinguishable areas of content
  const block_element_names = [
    'article', 'aside',  'blockquote', 'code',    'div',  'dl',
    'figure',  'footer', 'header',     'layer',   'main', 'mainmenu',
    'menu',    'nav',    'ol',         'picture', 'pre',  'section',
    'table',   'td',     'tr',         'ul'
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

    // Map of element names to bias values. This heavily penalizes certain
    // elements that are indications of navigation or non-content, and remains
    // relatively neutral or timid on other types. I include neutrals in the map
    // to be explicit about them, even though they produce the equivalent
    // non-bias, because I prefer to have the opinion be encoded clearly. We
    // only care about container-type elements, as in, those elements which may
    // contain other elements, that semantically tend to represent a unit or
    // block of content that should be treated as a whole. We do not care about
    // void elements or elements that contain only text (generally). This should
    // generally align with the container-element-names array, but exact
    // alignment is not important.
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

    let score = neutral_score;
    score += derive_depth_bias(block.depth);
    score += derive_element_type_bias(block.element_type, type_bias_map);
    score += derive_text_length_bias(block.text_length, info.text_length);
    score += derive_line_count_bias(block.text_length, block.line_count);
    score +=
        derive_anchor_density_bias(block.anchor_text_length, block.text_length);
    score += derive_list_bias(block.list_item_count);
    score += derive_paragraph_bias(block.paragraph_count);
    score += derive_field_bias(block.field_count);
    score += derive_image_bias(block.image_area, info.area);
    score +=
        derive_position_bias(block.element_index, info.front_max, info.end_min);

    // TODO: this should not rely on element
    score += derive_attribute_bias(block.element, token_weights);

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
  // boilerplate into content (given score adjustment by 1% at a time). Note
  // this implies we may not even reach the desired minimum threshold if we stop
  // bumping early.
  const max_iterations = 20;
  let iterations = 0;

  // Loop over the blocks, uniformly incrementing boilerplate block scores a bit
  // each iteration, until we reach the minimum content threshold or give up
  // after a number of iterations.
  let content_text_length = get_visible_content_length(blocks);
  let ratio = content_text_length / document_info.text_length;
  while (ratio < minimum_content_threshold && iterations < max_iterations) {
    // TEMP: debugging
    console.debug(
        'Adjusting scores to meet min-content-length threshold', ratio,
        minimum_content_threshold);

    // Slightly adjust all low scores. We do not favor any particular
    // block, everything gets a bump. This uniformly distributes some positive
    // bias because I think it indicates a generally flawed model.
    for (const block of blocks) {
      if (block.score < neutral_score) {
        block.score += 1;
      }
    }

    content_text_length = get_visible_content_length(blocks);
    ratio = content_text_length / document_info.text_length;
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
  // A live reference to the node in the full document. Each block tracks its
  // represented root element to allow for deferring processing that depends
  // on the element into later iterations over the live dom.
  this.element = element;

  // index into body-elements array. This is a representation of the position
  // of the block within the content. -1 means not set or invalid index or not
  // present in elements array.
  this.element_index = element_index;

  // index into the blocks array of the parent block. -1 indicates not set or
  // no parent.
  this.parent_block_index = -1;

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

  // A count of nested listed items (e.g. li, dl)
  this.list_item_count = 0;

  // A count of nested paragraphs
  this.paragraph_count = 0;

  // A count of nested form fields
  this.field_count = 0;

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
function derive_text_length_bias(block_text_length, document_text_length) {
  if (!document_text_length) {
    return 0;
  }

  if (!block_text_length) {
    return 0;
  }

  const ratio = block_text_length / document_text_length;

  // should be a param from somewhere
  const max_text_bias = 5;

  // Calc bias
  let bias = (100 * ratio * max_text_bias) | 0;
  // Cap influence to max
  bias = Math.min(max_text_bias, bias);

  return bias;
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

  // TODO: use a coefficient and round

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

function derive_element_type_bias(element_type, weights) {
  const bias = weights[element_type];
  return bias ? bias : 0;
}

function derive_paragraph_bias(paragraph_count) {
  return Math.min(20, paragraph_count * 5);
}

// Counts child paragraphs (not all descendants!)
function get_paragraph_count(element) {
  let count = 0;
  for (let child = element.firstElementChild; child;
       child = child.nextElementSibling) {
    if (child.localName === 'p') {
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


// TODO: this incorrectly penalizes certain lists, for example see
// https://theoutline.com/post/5208/eating-gummies-is-not-a-substitute-for-wearing-sunscreen
// Maybe this should be excluding ol/ul/dl themselves from being analyzed, and
// doing something like comparing it to neighboring text length. boilerplate
// tends to have very little text outside of the list, but in-main-content-area
// lists tend to have a lot of surrounding text. also note in the example page
// that the list in question does not have any links. Using -1 might be
// overkill.
function derive_list_bias(list_item_count) {
  return Math.max(-5, -1 * list_item_count);
}

// Count the number of descendant list items
function get_list_item_count(element) {
  return element.querySelectorAll('li, dd, dt').length;
}

// TODO: use block.attribute_tokens instead of tokenizing here

// Look at the values of attributes of a block element to indicate whether a
// block represents boilerplate
function derive_attribute_bias(element, token_weights) {
  const keys = ['id', 'name', 'class', 'itemprop', 'role'];
  const values = keys.map(key => element.getAttribute(key));
  const joined_values = values.join(' ');
  const normal_values = joined_values.toLowerCase();
  const tokens = tokenize(normal_values);
  const token_set = create_token_set(tokens);
  const max_token_len = 15;
  const small_token_set = token_set.filter(t => t.length <= max_token_len);

  let bias = 0;
  for (const token of small_token_set) {
    const token_bias = token_weights[token] || 0;
    bias += token_bias;
  }

  return bias;
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

function tokenize(value) {
  const values = value.split(/[\s\-_0-9]+/g);
  const non_empty_values = values.filter(v => v);
  return non_empty_values;
}

// Find the count of characters in anchors that are anywhere in the descendant
// hierarchy of this element. This assumes anchors do not contain each other
// (e.g. not misnested).
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
  // TODO: this is wrong, this is something that should be done per every
  // occurence of pre/code and affect all ancestor blocks, not just whether this
  // element itself is pre/code
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
