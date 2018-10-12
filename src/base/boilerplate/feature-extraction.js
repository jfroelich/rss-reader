import * as utils from './utils.js';

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
    block.text_length = utils.get_text_length(block.element.textContent);
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
    const text_length = utils.get_text_length(anchor.textContent);
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
