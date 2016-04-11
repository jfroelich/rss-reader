// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/calamine/ancestor-bias.js
// Requires: /src/calamine/attribute-bias.js
// Requires: /src/calamine/image-bias.js
// Requires: /src/calamine/text-bias.js

// Scores each of the candidate elements and returns the one with
// the highest score
function calamine_find_highest_scoring_element(document) {
  'use strict';

  // Only these elements are considered as potential best elements
  const CANDIDATE_SELECTOR = [
    'ARTICLE', 'CONTENT', 'DIV', 'LAYER', 'MAIN', 'SECTION', 'SPAN', 'TD'
  ].join(',');

  const bodyElement = document.body;
  if(!bodyElement) {
    // Always return something.
    return document.documentElement;
  }

  // Init to documentElement. This ensures we always return something and
  // also sets documentElement as the default best element.

  let bestElement = document.documentElement;
  const elements = bodyElement.querySelectorAll(CANDIDATE_SELECTOR);
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

// Penalizes an element for being a descendant of a list or list item
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
