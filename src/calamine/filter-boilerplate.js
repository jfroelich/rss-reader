// See license.md
'use strict';

{ // Begin file block scope

function filter_boilerplate(doc) {
  if(!doc.body)
    return;
  const best_element = find_high_score_element(doc);
  prune(doc, best_element);
}

// Bias an element based on the text it contains and the ratio of the text
// outside of anchors to text inside of anchors.
// Returns the bias as a double
// For speed this compares approximate char count instead of word count
function derive_text_bias(element) {
  const text = condense_whitespace(element.textContent);
  const text_length = text.length;
  const anchor_length = derive_anchor_length(element);
  return (0.25 * text_length) - (0.7 * anchor_length);
}

// Assumes document is well-formed, meaning no nested anchors.
function derive_anchor_length(element) {
  const anchors = element.querySelectorAll('a[href]');
  let anchor_length = 0;
  for(const anchor of anchors) {
    const text = condense_whitespace(anchor.textContent);
    anchor_length = anchor_length + text.length;
  }
  return anchor_length;
}

// Returns the bias for an element based on its child elements
function derive_ancestor_bias(element) {
  const ancestor_bias_map = {
    'a': -5,
    'aside': -50,
    'blockquote': 20,
    'br': 3,
    'div': -50,
    'figure': 20,
    'h1': 10,
    'h2': 10,
    'h3': 10,
    'h4': 10,
    'h5': 10,
    'h6': 10,
    'nav': -100,
    'ol': -20,
    'p': 10,
    'pre': 10,
    'section': -20,
    'ul': -20
  };

  let total_bias = 0;
  for(let child_element = element.firstElementChild; child_element;
    child_element = child_element.nextElementSibling) {
    const bias = ancestor_bias_map[child_element.localName];
    if(bias)
      total_bias = total_bias + bias;
  }
  return total_bias;
}

// Calculates and returns the bias for an element based on the values of
// some of its attributes
function derive_attr_bias(element) {
  var token_weight_map = {
    'ad': -500,
    'ads': -500,
    'advert': -500,
    'article': 500,
    'body': 500,
    'comment': -500,
    'content': 500,
    'contentpane': 500,
    'gutter': -300,
    'left': -50,
    'main': 500,
    'meta': -50,
    'nav': -200,
    'navbar': -200,
    'newsarticle': 500,
    'page': 200,
    'post': 300,
    'promo': -100,
    'rail': -300,
    'rel': -50,
    'relate': -500,
    'related': -500,
    'right': -50,
    'social': -200,
    'story': 100,
    'storytxt': 500,
    'tool': -200,
    'tools': -200,
    'widget': -200,
    'zone': -50
  };

  var total_bias = 0;
  var vals = [element.id, element.name, element.className];
  var vals_flat_string = vals.join(' ');
  if(vals_flat_string.length < 3)
    return total_bias;
  var norm_vals_string = vals_flat_string.toLowerCase();
  var tokens = norm_vals_string.split(/[\s\-_0-9]+/g);
  var tokens_length = tokens.length;
  var seen_tokens = {};
  var bias = 0;
  var token;

  for(var i = 0; i < tokens_length; i++) {
    token = tokens[i];
    if(!token)
      continue;
    if(token in seen_tokens)
      continue;
    seen_tokens[token] = 1;
    bias = token_weight_map[token];
    if(bias)
      total_bias = total_bias + bias;
  }

  return total_bias;
}

function find_high_score_element(doc) {
  var candidate_selector =
    'article, content, div, layer, main, section, span, td';
  var list_selector = 'li, ol, ul, dd, dl, dt';
  var nav_selector = 'aside, header, footer, nav, menu, menuitem';
  var best_element = doc.documentElement;
  if(!doc.body)
    return best_element;
  var elements = doc.body.querySelectorAll(candidate_selector);
  var high_score = 0.0;
  for(var element of elements) {
    var score = derive_text_bias(element);
    if(element.closest(list_selector))
      score -= 200.0;
    if(element.closest(nav_selector))
      score -= 500.0;
    score += derive_ancestor_bias(element);
    score += derive_img_bias(element);
    score += derive_attr_bias(element);
    if(score > high_score) {
      best_element = element;
      high_score = score;
    }
  }

  return best_element;
}

function derive_img_bias(parent_element) {
  let bias = 0.0;
  let image_count = 0;
  for(let node of parent_element.childNodes) {
    if(node.localName === 'img') {
      bias += derive_img_area_bias(node) + derive_img_text_bias(node);
      image_count++;
    }
  }

  // Penalize carousels
  if(image_count > 1)
    bias += -50 * (image_count - 1);
  return bias;
}

// Reward supporting text of images
function derive_img_text_bias(img_element) {
  let bias = 0;
  if(img_element.hasAttribute('alt'))
    bias += 20;
  if(img_element.hasAttribute('title'))
    bias += 30;
  if(find_img_caption(img_element))
    bias += 100;
  return bias;
}

// Reward large images
function derive_img_area_bias(img_element) {
  let bias = 0.0;
  const max_area = 100000;
  const damp_coef = 0.0015;
  const area = img_element.width * img_element.height;
  if(area)
    bias = damp_coef * Math.min(max_area, area);
  return bias;
}

function find_img_caption(img_element) {
  const figure_element = img_element.closest('figure');
  let caption_element;
  if(figure_element)
    caption_element = figure_element.querySelector('figcaption');
  return caption_element;
}

// Detach elements that do not intersect with the best element
function prune(doc, best_element) {
  if(best_element === doc.documentElement)
    return;
  if(best_element === doc.body)
    return;
  if(!doc.documentElement.contains(best_element))
    throw new TypeError('best element not attached to document');

  const elements = doc.body.querySelectorAll('*');
  for(let element of elements) {
    // Keep ancestors of best element
    if(element.contains(best_element))
      continue;
    // Keep descendants of best element
    if(best_element.contains(element))
      continue;
    // Ignore children of removed elements
    if(!doc.documentElement.contains(element))
      continue;
    element.remove();
  }
}

function condense_whitespace(string) {
  return string.replace(/\s+/g, '');
}

// Public exports
this.filter_boilerplate = filter_boilerplate;

} // End file scope
