(function(exports) {
'use strict';

// Returns a boilerplate model
// TODO: right now this just returns defaults
function bp_create_model(options) {
  const model = {};
  model.candidate_selecotr =
    'article, content, div, layer, main, section, span, td';
  model.evaluate = get_element_score;
  return model;
}

function get_element_score(element) {
  const list_selector = 'li, ol, ul, dd, dl, dt';
  const nav_selector = 'aside, header, footer, nav, menu, menuitem';
  let score = 0;

  score = derive_text_bias(element);
  if(element.closest(list_selector))
    score -= 200;
  if(element.closest(nav_selector))
    score -= 500;
  score += derive_ancestor_bias(element);
  score += derive_child_images_bias(element);
  score += derive_element_attribute_bias(element);
  return score;
}

function condense_whitespace(string) {
  return string.replace(/\s+/g, '');
}

// Bias an element based on the text it contains and the ratio of the text
// outside of anchors to text inside of anchors.
// Returns the bias as a int
// For speed this compares approximate char count instead of word count
function derive_text_bias(element) {
  const text = condense_whitespace(element.textContent);
  const text_length = text.length;
  const anchor_length = derive_anchor_length(element);
  const bias_float = (0.25 * text_length) - (0.7 * anchor_length);
  const bias_int = bias_float | 0;
  return bias_int;
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
function derive_element_attribute_bias(element) {
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

function derive_child_images_bias(parent_element) {
  let bias = 0;
  let image_count = 0;
  for(let node of parent_element.childNodes) {
    if(node.localName === 'img') {
      bias += derive_image_area_bias(node) + derive_image_text_bias(node);
      image_count++;
    }
  }

  const carousel_penalty = -50;
  if(image_count > 1)
    bias += carousel_penalty * (image_count - 1);
  return bias;
}

// Reward supporting text of images
function derive_image_text_bias(image_element) {
  let bias = 0;
  if(image_element.hasAttribute('alt'))
    bias += 20;
  if(image_element.hasAttribute('title'))
    bias += 30;
  if(find_img_caption(image_element))
    bias += 100;
  return bias;
}

// Reward large images
function derive_image_area_bias(image_element) {

  // Init width and height. If one is missing then assume square image
  let width = 0, height = 0;
  if(image_element.hasAttribute('width')) {
    width = image_element.width;
    if(image_element.hasAttribute('height'))
      height = image_element.height;
    else
      height = width;
  } else if(image_element.hasAttribute('height')) {
    height = image_element.height;
    width = height;
  }

  const original_area = image_element.width * image_element.height;
  if(original_area) {
    // Clamp to prevent overly large bias
    const max_area = 100000;
    const clamped_area = Math.min(max_area, original_area);

    // Dampen to give a proportional strength relative to other hard coded
    // empiraclly collected scores
    const damp_coef = 0.0015;
    const dampened_bias_float = damp_coef * clamped_area;
    // Return the value as an integer
    return dampened_bias_float | 0;
  } else {
    return 0;
  }
}

function find_img_caption(image_element) {
  const figure_element = image_element.closest('figure');
  let caption_element;
  if(figure_element)
    caption_element = figure_element.querySelector('figcaption');
  return caption_element;
}


exports.bp_create_model = bp_create_model;

}(this));
