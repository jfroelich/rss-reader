// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/calamine/ancestor-bias.js
// Requires: /src/calamine/attribute-bias.js
// Requires: /src/calamine/image-bias.js
// Requires: /src/calamine/text-bias.js

// Only these elements are considered as potential best elements
const CALAMINE_CANDIDATE_SELECTOR = [
  'ARTICLE', 'CONTENT', 'DIV', 'LAYER', 'MAIN', 'SECTION', 'SPAN', 'TD'
].join(',');

// Scores each of the candidate elements and returns the one with
// the highest score
function calamine_find_highest_scoring_element(document) {
  'use strict';

  const LIST_SELECTOR = 'LI, OL, UL, DD, DL, DT';
  const NAV_SELECTOR = 'ASIDE, HEADER, FOOTER, NAV, MENU, MENUITEM';

  // Init to documentElement. This ensures we always return something and
  // also sets documentElement as the default best element.
  let bestElement = document.documentElement;

  const bodyElement = document.body;
  if(!bodyElement) {
    return bestElement;
  }

  const elementNodeList = bodyElement.querySelectorAll(
    CALAMINE_CANDIDATE_SELECTOR);
  const listLength = elementNodeList.length;
  let element = null;
  let highScore = 0.0;
  let score = 0.0;

  for(let i = 0; i < listLength; i++) {
    element = elementNodeList[i];

    score = calamine_derive_text_bias(element);

    if(element.closest(LIST_SELECTOR)) {
      score -= 200.0;
    }

    if(element.closest(NAV_SELECTOR)) {
      score -= 500.0;
    }

    score += calamine_derive_ancestor_bias(element);
    score += calamine_derive_image_bias(element);
    score += calamine_derive_attribute_bias(element);

    if(score > highScore) {
      bestElement = element;
      highScore = score;
    }
  }

  return bestElement;
}
