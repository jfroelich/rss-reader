// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file


const CALAMINE_ANCESTOR_BIAS = {
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
