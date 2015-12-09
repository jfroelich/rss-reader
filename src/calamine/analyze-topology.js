// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: use for..of once Chrome supports NodeList iteration
function analyzeTopology(document) {
  const scores = new Map();
  let elements = document.querySelectorAll(
    'li *, ol *, ul *, dd *, dl *, dt *');
  for(let i = 0, len = elements.length, element; i < len; i++) {
    element = elements[i];
    scores.set(element, (scores.get(element) || 0.0) - 100.0);
  }

  elements = document.querySelectorAll(
    'aside *, header *, footer *, nav *, menu *, menuitem, *');
  for(let i = 0, len = elements.length, element; i < len; i++) {
    element = elements[i];
    scores.set(element, (scores.get(element) || 0.0) - 500.0);
  }

  let upBias = 0;
  for(let entry of UPWARD_BIAS) {
    elements = document.getElementsByTagName(entry[0]);
    upBias = entry[1];
    for(let i = 0, len = elements.length, element, parent; i < len; i++) {
      element = elements[i];
      parent = element.parentElement;
      if(parent) {
        scores.set(element, (scores.get(element) || 0.0) + upBias);
      }
    }
  }

  return scores;
}

this.analyzeTopology = analyzeTopology;

const UPWARD_BIAS = new Map([
  ['a', -5],
  ['blockquote', 20],
  ['div', -50],
  ['figure', 20],
  ['h1', 10],
  ['h2', 10],
  ['h3', 10],
  ['h4', 10],
  ['h5', 10],
  ['h6', 10],
  ['li', -5],
  ['ol', -20],
  ['p', 100],
  ['pre', 10],
  ['ul', -20]
]);

} // END ANONYMOUS NAMESPACE
