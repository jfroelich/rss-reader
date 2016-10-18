// See license.md

/*
TODO:
- reintroduce support for annotating elements
- filter in-document titles
- consider scoring on a scale, or use probability
- revert to blocks instead of best element
- review justText thesis
*/

'use strict';

{

function filter_boilerplate(doc) {
  const best_element = find_high_score_element(doc);
  prune(doc, best_element);
}

// Returns a measure indicating whether the element contains boilerplate or
// content based on its text. Elements with a large amount of text are
// generally more likely to be content. Elements with a small amount of text
// contained within anchors are more likely to be content.
// The metric is adapted from the paper:
// "Boilerplate Detection using Shallow Text Features".
// See http://www.l3s.de/~kohlschuetter/boilerplate.
function derive_text_bias(element) {
  const text = element.textContent;
  const trimmed_text = text.trim();
  const text_len = 0.0 + trimmed_text.length;
  const anchor_len = 0.0 + derive_anchor_len(element);
  return (0.25 * text_len) - (0.7 * anchor_len);
}

// Returns the approximate number of characters contained within anchors that
// are descendants of the element.
// This assumes that the HTML is generally well-formed. Specifically it assumes
// no anchor nesting.
function derive_anchor_len(element) {
  let anchor_len = 0;
  const anchors = element.querySelectorAll('a[href]');
  for(let anchor of anchors) {
    anchor_len = anchor_len + anchor.textContent.trim().length;
  }
  return anchor_len;
}

// These scores adjust the parent scores of these elements. A parent element
// is more likely to be the best element or a content element when it contains
// several paragraphs and headers. Parents are more likely to be boilerplate
// or not the best element when containing lists, asides, and navigational
// sections.
// The values are empirical.
// Ancestor bias contributes very little to an element's total bias in
// comparision to some of the other biases. The most help comes when there is
// a clear container element of multiple paragraphs.
// TODO: switch back to lowercase and use node.localName to lookup
const ancestor_bias_map = {
  'A': -5,
  'ASIDE': -50,
  'BLOCKQUOTE': 20,
  'BR': 3,
  'DIV': -50,
  'FIGURE': 20,
  'H1': 10,
  'H2': 10,
  'H3': 10,
  'H4': 10,
  'H5': 10,
  'H6': 10,
  'NAV': -100,
  'OL': -20,
  'P': 10,
  'PRE': 10,
  'SECTION': -20,
  'UL': -20
};

function derive_ancestor_bias(element) {
  let total_bias = 0;
  for(let child = element.firstElementChild; child;
    child = child.nextElementSibling) {
    const bias = ancestor_bias_map[child.nodeName];
    if(bias) {
      total_bias = total_bias + bias;
    }
  }

  return total_bias;
}

// If one of these tokens is found in an attribute value of an element,
// these bias the element's boilerplate score. A higher score means that the
// element is more likely to be content. This list was created empirically.
const attr_token_weights = {
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

// Computes a bias for an element based on the values of some of its
// attributes.
// NOTE: using var due to v8 deopt warnings - Unsupported use of phi const
function derive_attr_bias(element) {
  // Start by merging the element's interesting attribute values into a single
  // string in preparation for tokenization.
  // Accessing attributes by property is faster than using getAttribute. It
  // turns out that getAttribute is horribly slow in Chrome. I have not figured
  // out why, and I have not figured out a workaround.
  var vals_array = [element.id, element.name, element.className];

  // Array.prototype.join implicitly filters null/undefined values so we do not
  // need to check if the property values are defined.
  var vals_str = vals_array.join(' ');

  // If the element did not have attribute values, then the vals_str
  // variable will only contain whitespace or some negligible token so we exit
  // early to minimize the work done.
  // TODO: maybe I want to declare total bias before this and return total
  // bias here so that I am more consistent about the value returned and its
  // type, so it serves as a better reminder.
  if(vals_str.length < 3) {
    return 0.0;
  }

  // Lowercase the values in one pass. Even though toLowerCase now has to
  // consider extra spaces in its input because it occurs after the join, we
  // don't have to check if inputs are defined non-natively because join did
  // that for us. Also, this is one function call in contrast to 3. toLowerCase
  // scales better with larger strings that the JS engine scales with function
  // calls.
  var lc_vals_str = vals_str.toLowerCase();
  var token_array = lc_vals_str.split(/[\s\-_0-9]+/g);

  // Now add up the bias of each distinct token. Previously this was done in
  // two passes, with the first pass generating a new array of distinct tokens,
  // and the second pass summing up the distinct token biases. I seem to get
  // better performance without creating an intermediate array.

  var token_array_len = token_array.length;

  // I use the in operator to test membership which follows the prototype
  // so i think it makes sense to reduce the scope of the lookup by excluding
  // the prototype here (???)
  var seen_tokens = Object.create(null);
  var total_bias = 0;
  var bias = 0;
  var token;

  for(var i = 0; i < token_array_len; i++) {
    token = token_array[i];

    // Split can yield empty strings for some reason, so skip those.
    if(!token) {
      continue;
    }

    if(token in seen_tokens) {
      continue;
    } else {
      seen_tokens[token] = 1;
    }

    bias = attr_token_weights[token];
    if(bias) {
      total_bias += bias;
    }
  }

  return 0.0 + total_bias;
}


function find_high_score_element(doc) {
  const candidate_selector =
    'ARTICLE, CONTENT, DIV, LAYER, MAIN, SECTION, SPAN, TD';
  const list_selector = 'LI, OL, UL, DD, DL, DT';
  const nav_selector = 'ASIDE, HEADER, FOOTER, NAV, MENU, MENUITEM';

  // Init to documentElement. This ensures we always return something and also
  // sets documentElement as the default best element.
  let best_element = doc.documentElement;

  const body = doc.body;
  if(!body) {
    return best_element;
  }

  const elements = body.querySelectorAll(candidate_selector);
  let high_score = 0.0;
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    let score = 0.0 + derive_text_bias(element);

    if(element.closest(list_selector)) {
      score -= 200.0;
    }

    if(element.closest(nav_selector)) {
      score -= 500.0;
    }

    score += 0.0 + derive_ancestor_bias(element);
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
  let num_imgs = 0;
  let area = 0;

  for(let element = parent_element.firstElementChild; element;
    element = element.nextElementSibling) {
    if(element.localName !== 'img') {
      continue;
    }

    // Increase score for containing a large image
    area = element.width * element.height;
    if(area) {
      bias = bias + (0.0015 * Math.min(100000.0, area));
    }

    // Increase score for containing descriptive information
    if(element.getAttribute('alt')) {
      bias = bias + 20.0;
    }

    if(element.getAttribute('title')) {
      bias = bias + 30.0;
    }

    if(find_caption(element)) {
      bias = bias + 100.0;
    }

    num_imgs++;
  }

  // Penalize carousels
  if(num_imgs > 1) {
    bias = bias + (-50.0 * (num_imgs - 1));
  }

  return bias;
}

function find_caption(image) {
  const figure = image.closest('figure');
  return figure ? figure.querySelector('FIGCAPTION') : null;
}

// Remove elements that do not intersect with the best element
// In order to reduce the number of removals, this uses a contains check
// to avoid removing elements that exist in the static node list but
// are descendants of elements removed in a previous iteration. The
// assumption is that this yields better performance.
// TODO: use compareDocumentPosition instead of multiple contains calls
function prune(doc, best_element) {
  if(!best_element)
    throw new TypeError();
  if(best_element === doc.documentElement)
    return;
  if(!doc.body)
    return;

  const doc_element = doc.documentElement;
  const elements = doc.body.querySelectorAll('*');
  for(let element of elements) {
    if(!element.contains(best_element) &&
      !best_element.contains(element) &&
      doc_element.contains(element)) {
      element.remove();
    }
  }
}

this.filter_boilerplate = filter_boilerplate;

}
