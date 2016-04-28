// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// These scores adjust the parent scores of these elements. A parent element
// is more likely to be the best element or a content element when it contains
// several paragraphs and headers. Parents are more likely to be boilerplate
// or not the best element when containing lists, asides, and navigational
// sections.
// The values are empirical.
// Ancestor bias contributes very little to an element's total bias in
// comparision to some of the other biases. The most help comes when there is
// a clear container element of multiple paragraphs.

const CALAMINE_ANCESTOR_BIAS = {
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

// Derives a bias based on child elements
function calamine_derive_ancestor_bias(element) {
  let totalBias = 0;
  let bias = 0;

  // Walk the child elements and sum up the each child's bias
  for(let childElement = element.firstElementChild; childElement;
    childElement = childElement.nextElementSibling) {
    bias = CALAMINE_ANCESTOR_BIAS[childElement.nodeName];

    // Using += sugar seems to cause deopt issues when using let or const (at
    // least in Chrome 49), hence the expanded syntax.
    if(bias) {
      totalBias = totalBias + bias;
    }
  }

  // Return a double (or is it long? whatever) so that type coercion is
  // explicit. Externally, scores when aggregated are doubles because certain
  // other biases are doubles.

  // TODO: maybe the coercion is the responsibility of the caller and not
  // this function's concern?

  return 0.0 + totalBias;
}
