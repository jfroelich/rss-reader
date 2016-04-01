// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Rudimentary lib for filtering boilerplate content from a document
// Requires: /src/utils.js
// TODO: re-introduce support for annotation

// Looks for the element that is most likely the root element of the content
// and removes elements all other elements.
function calamine_apply(document) {
  'use strict';

  let bestElement = calamine_find_signature(document) ||
    calamine_find_highest_scoring_element(document);
  if(bestElement !== document.documentElement) {
    calamine_prune(document, bestElement);
  }
}

var CALAMINE_SIGNATURES = [
  'ARTICLE',
  '.hentry',
  '.entry-content',
  '#article',
  '.articleText',
  '.articleBody',
  '#articleBody',
  '.article_body',
  '.articleContent',
  '.full-article',
  '.repository-content',
  '[itemprop="articleBody"]',
  '[role="article"]',
  'DIV[itemtype="http://schema.org/Article"]',
  'DIV[itemtype="http://schema.org/BlogPosting"]',
  'DIV[itemtype="http://schema.org/Blog"]',
  'DIV[itemtype="http://schema.org/NewsArticle"]',
  'DIV[itemtype="http://schema.org/TechArticle"]',
  'DIV[itemtype="http://schema.org/ScholarlyArticle"]',
  'DIV[itemtype="http://schema.org/WebPage"]',
  '#WNStoryBody'
];

// Looks for the first single occurrence of an element matching
// one of the signatures
function calamine_find_signature(document) {
  'use strict';
  for(let i = 0, len = CALAMINE_SIGNATURES.length, elements; i < len; i++) {
    elements = document.querySelectorAll(CALAMINE_SIGNATURES[i]);
    if(elements.length === 1) {
      return elements[0];
    }
  }
}

// Only these elements are considered as potential best elements
var CALAMINE_CANDIDATE_SELECTOR = [
  'ARTICLE', 'CONTENT', 'DIV', 'LAYER', 'MAIN', 'SECTION', 'SPAN', 'TD'
].join(',');

// Scores each of the candidate elements and returns the one with
// the highest score
function calamine_find_highest_scoring_element(document) {
  'use strict';

  let bestElement = document.documentElement;
  const elements = document.querySelectorAll(CALAMINE_CANDIDATE_SELECTOR);
  const numElements = elements.length;
  for(let i = 0, element, highScore = 0.0, score = 0.0;
    i < numElements; i++) {
    element = elements[i];
    score = calamine_derive_element_score(element);
    if(score > highScore) {
      bestElement = element;
      highScore = score;
    }
  }

  return bestElement;
}

// Calculates an elements score. A higher score means the element is more
// likely to be the root element of the content of the document containing
// the element
function calamine_derive_element_score(element) {
  'use strict';

  const textBias = calamine_derive_text_bias(element);
  const listBias = calamine_derive_list_bias(element);
  const navBias = calamine_derive_nav_bias(element);
  const ancestorBias = calamine_derive_ancestor_bias(element);
  const imageBias = calamine_derive_image_bias(element);
  const attributeBias = calamine_derive_attribute_bias(element);
  return textBias + listBias + navBias + ancestorBias + imageBias +
    attributeBias;
}

// Returns the approximate number of characters contained within anchors that
// are descendants of the element. Assumes no anchor nesting.
function calamine_derive_anchor_length(element) {
  'use strict';

  const anchors = element.querySelectorAll('A[href]');

  const numAnchors = anchors.length;
  let anchorLength = 0;
  for(let i = 0, anchor, content; i < numAnchors; i++) {
    anchor = anchors[i];
    content = anchor.textContent.trim();
    anchorLength = anchorLength + content.length;
  }

  return anchorLength;
}

// This returns a approximate measure representing a ratio of the amount of
// text in the element to text within descendant anchors. The text bias metric
// is adapted from the paper "Boilerplate Detection using Shallow Text
// Features". See http://www.l3s.de/~kohlschuetter/boilerplate.
function calamine_derive_text_bias(element) {
  'use strict';

  const text = element.textContent;
  const trimmedText = text.trim();
  const textLength = 0.0 + trimmedText.length;
  const anchorLength = 0.0 + calamine_derive_anchor_length(element);
  return (0.25 * textLength) - (0.7 * anchorLength);
}

// Penalizes an element for being a descendant of a list
function calamine_derive_list_bias(element) {
  'use strict';
  const LIST_SELECTOR = 'LI, OL, UL, DD, DL, DT';
  return element.closest(LIST_SELECTOR) ? -200.0 : 0.0;
}

// Penalizes an element for being a descendant of a navigational section
function calamine_derive_nav_bias(element) {
  'use strict';
  const NAV_SELECTOR = 'ASIDE, HEADER, FOOTER, NAV, MENU, MENUITEM';
  return element.closest(NAV_SELECTOR) ? -500.0 : 0.0;
}

var CALAMINE_ANCESTOR_BIAS = {
  'A': -5.0,
  'ASIDE': -50.0,
  'BLOCKQUOTE': 20.0,
  'BR': 3.0,
  'DIV': -50.0,
  'FIGURE': 20.0,
  'H1': 10.0,
  'H2': 10.0,
  'H3': 10.0,
  'H4': 10.0,
  'H5': 10.0,
  'H6': 10.0,
  'NAV': -100.0,
  'OL': -20.0,
  'P': 10.0,
  'PRE': 10.0,
  'SECTION': -20.0,
  'UL': -20.0
};

// Derives a bias based on the immediate child elements
// NOTE: using var due to deopt
function calamine_derive_ancestor_bias(element) {
  'use strict';

  let totalBias = 0.0;
  let name = null;
  let bias = 0.0;

  for(let childElement = element.firstElementChild; childElement;
    childElement = childElement.nextElementSibling) {
    bias = CALAMINE_ANCESTOR_BIAS[childElement.nodeName];
    totalBias = totalBias + (bias || 0.0);
  }

  return totalBias;
}

// Derives a bias based on child images
function calamine_derive_image_bias(parentElement) {
  'use strict';

  let bias = 0.0;
  let numImages = 0;
  let area = 0;

  // Walk the child elements, looking for images
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(element.nodeName !== 'IMG') {
      continue;
    }

    area = element.width * element.height;

    if(area) {
      bias = bias + (0.0015 * Math.min(100000.0, area));
    }

    if(element.getAttribute('alt')) {
      bias = bias + 20.0;
    }

    if(element.getAttribute('title')) {
      bias = bias + 30.0;
    }

    if(calamine_find_image_caption(element)) {
      bias = bias + 100.0;
    }

    numImages++;
  }

  // Penalize elements containing multiple images. These are usually
  // carousels.
  if(numImages > 1) {
    bias = bias + (-50.0 * (numImages - 1));
  }

  return bias;
}

function calamine_find_image_caption(image) {
  'use strict';

  // NOTE: unclear whether closest still works if using uppercase

  const figure = image.closest('figure');
  return figure ? figure.querySelector('FIGCAPTION') : null;
}

// Derives a bias to an element's score based on its attributes
// TODO: maybe it is ok to assume that id and name are always single
// words and never multi-word values, and maybe i only need to
// calamine_tokenize className, does the spec say id cannot have space?
// TODO: improve performance
function calamine_derive_attribute_bias(element) {
  'use strict';

  const TOKEN_WEIGHTS = {
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

  // Merge attribute values into a single string
  // Accessing attributes by property is faster than using getAttribute
  // The join implicitly filters null values
  const values = [element.id, element.name, element.className].join(' ');

  // If the element did not have any values for the attributes checked,
  // then values will only contain a small string of spaces so we exit early
  // to minimize the work done.
  if(values.length < 3) {
    return 0.0;
  }

  // Normalize
  const lowerValues = values.toLowerCase();

  // Tokenize into words
  const tokens = lowerValues.split(/[\s\-_0-9]+/g);

  // Add up the bias of each distinct token
  const numTokens = tokens.length;
  const seen = {};
  let totalBias = 0;
  for(let i = 0, bias = 0, token = ''; i < numTokens; i++) {
    token = tokens[i];

    if(!token) {
      continue;
    }

    if(token in seen) {
      continue;
    }

    seen[token] = 1;
    bias = TOKEN_WEIGHTS[token];
    if(bias) {
      totalBias = totalBias + bias;
    }
  }

  const totalBiasAsLong = 0.0 + totalBias;
  return totalBiasAsLong;
}

// Remove elements that do not intersect with the best element
function calamine_prune(document, bestElement) {
  'use strict';

  // In order to reduce the number of removals, this uses a contains check
  // to avoid removing elements that exist in the static node list but
  // are descendants of elements removed in a previous iteration. The
  // assumption is that this yields better performance.

  // TODO: instead of doing two calls to contains, I think I can use one
  // call to compareDocumentPosition and then check against its result.
  // I am not very familiar with compareDocumentPosition yet, that is the
  // only reason I am not using it.

  const docElement = document.documentElement;
  const elements = document.querySelectorAll('*');
  const numElements = elements.length;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(!element.contains(bestElement) && !bestElement.contains(element) &&
      docElement.contains(element)) {
      element.remove();
    }
  }
}
