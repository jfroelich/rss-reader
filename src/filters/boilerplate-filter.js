'use strict';

// import base/status.js
// import base/string.js
// import dom/image.js

const BOILERPLATE_ANCESTOR_BIASES = {
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

const BOILERPLATE_TOKEN_WEIGHTS = {
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


function boilerplate_filter(doc) {
  console.assert(doc instanceof Document);
  if(!doc.body) {
    return STATUS_OK;
  }

  const best_element = boilerplate_find_high_score_element(doc);
  boilerplate_prune(doc, best_element);

  return STATUS_OK;
}

function boilerplate_derive_text_bias(element) {
  const text = string_condense_whitespace(element.textContent);
  const text_length = text.length;
  const anchor_length = boilerplate_derive_anchor_length(element);
  return 0.25 * text_length - 0.7 * anchor_length;
}

function boilerplate_derive_anchor_length(element) {
  const anchors = element.querySelectorAll('a[href]');
  let anchor_length = 0;
  for(const anchor of anchors) {
    const text = string_condense_whitespace(anchor.textContent);
    anchor_length = anchor_length + text.length;
  }
  return anchor_length;
}

function boilerplate_derive_ancestor_bias(element) {
  let total_bias = 0;
  for(let child_element = element.firstElementChild; child_element;
    child_element = child_element.nextElementSibling) {
    const bias = BOILERPLATE_ANCESTOR_BIASES[child_element.localName];
    if(bias)
      total_bias = total_bias + bias;
  }
  return total_bias;
}

function boilerplate_derive_attribute_bias(element) {
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
    bias = BOILERPLATE_TOKEN_WEIGHTS[token];
    if(bias)
      total_bias = total_bias + bias;
  }

  return total_bias;
}

function boilerplate_find_high_score_element(doc) {
  var candidate_selector =
    'article, content, div, layer, main, section, span, td';
  var list_selector = 'li, ol, ul, dd, dl, dt';
  var nav_selector = 'aside, header, footer, nav, menu, menuitem';
  var best_element = doc.documentElement;
  if(!doc.body)
    return best_element;
  var elements = doc.body.querySelectorAll(candidate_selector);
  var high_score = 0;
  for(var element of elements) {
    var score = boilerplate_derive_text_bias(element);
    if(element.closest(list_selector))
      score -= 200;
    if(element.closest(nav_selector))
      score -= 500;
    score += boilerplate_derive_ancestor_bias(element);
    score += boilerplate_derive_image_bias(element);
    score += boilerplate_derive_attribute_bias(element);
    if(score > high_score) {
      best_element = element;
      high_score = score;
    }
  }

  return best_element;
}

function boilerplate_derive_image_bias(parent_element) {
  let bias = 0;
  let image_count = 0;
  for(let node of parent_element.childNodes) {
    if(node.localName === 'img') {
      bias += boilerplate_derive_image_area_bias(node) +
        boilerplate_derive_image_text_bias(node);
      image_count++;
    }
  }

  // Penalize carousels
  if(image_count > 1)
    bias += -50 * (image_count - 1);
  return bias;
}

// Reward supporting text of images
function boilerplate_derive_image_text_bias(image) {
  let bias = 0;
  if(image.hasAttribute('alt'))
    bias += 20;
  if(image.hasAttribute('title'))
    bias += 30;
  if(image_find_caption(image))
    bias += 100;
  return bias;
}

function boilerplate_derive_image_area_bias(image) {
  let bias = 0;
  const max_area = 100000;
  const damp_coef = 0.0015;
  const area = image.width * image.height;
  if(area)
    bias = damp_coef * Math.min(max_area, area);
  return bias;
}

function boilerplate_prune(doc, best_element) {
  console.assert(doc.documentElement.contains(best_element));

  if(best_element === doc.documentElement)
    return;
  if(best_element === doc.body)
    return;

  const elements = doc.body.querySelectorAll('*');
  for(const element of elements) {
    if(element.contains(best_element))
      continue;
    if(best_element.contains(element))
      continue;
    if(!doc.documentElement.contains(element))
      continue;
    element.remove();
  }
}
