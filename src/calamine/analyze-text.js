// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Calculates and records the text bias for elements. The text bias metric is
// adapted from the paper "Boilerplate Detection using Shallow Text Features".
// See http://www.l3s.de/~kohlschuetter/boilerplate.

// NOTE: const/let is causing de-opts, so using var

function analyzeText(document) {
  var scores = new Map();
  var textLengths = deriveTextLength(document);
  var anchorLengths = deriveAnchorLength(document, textLengths);
  var elements = document.getElementsByTagName('*');
  var forEach = Array.prototype.forEach;
  var derive = deriveTextScore.bind(this, scores, textLengths, anchorLengths);
  forEach.call(elements, derive);
  return scores;
}

// Export global
this.analyzeText = analyzeText;

function deriveTextScore(scores, textLengths, anchorLengths, element) {
  var length = textLengths.get(element);
  if(!length) return;
  var anchorLength = anchorLengths.get(element) || 0;
  var weight = (0.25 * length) - (0.7 * anchorLength);
  // Cap the score (??)
  weight = Math.min(4000.0, weight);
  if(!weight) return;
  scores.set(element, (scores.get(element) || 0.0) + weight);
}

const RE_WHITESPACE = /\s|&nbsp;/g;

function getNodeTextLength(node) {
  const value = node.nodeValue;

  // Turns out that testing for the most frequent text nodes provides a
  // noticeable perf improvement :)
  if(value === '\n' || value === '\n\t' || value === '\n\t\t') {
    return 0;
  } else {
    // TODO: note where i got this from on stackoverflow
    // TODO: we probably only care about consecutive space in the middle
    // and trimming?
    return value.replace(RE_WHITESPACE, '').length;
  }
}

// Generate a map between document elements and a count
// of characters within the element. This is tuned to work
// from the bottom up rather than the top down.
function deriveTextLength(document) {
  const map = new Map();

  const it = document.createNodeIterator(
    document.documentElement,
    NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  let length = 0;
  let element = null;
  let previousLength = 0;
  while(node) {
    length = getNodeTextLength(node);
    if(length) {
      element = node.parentElement;
      while(element) {
        previousLength = map.get(element) || 0;
        map.set(element, previousLength + length);
        element = element.parentElement;
      }
    }

    node = it.nextNode();
  }

  return map;
}

// Generate a map between document elements and a count of
// the characters contained within anchor elements present
// anywhere within the elements
// NOTE: chrome is giving a de-opt warning here, so testing with var
// NOTE: Chrome is whining about unsupported phi use of const variable
// and it may be due to declaring consts in loops

function deriveAnchorLength(document, textLengths) {
  var anchors = document.querySelectorAll('a[href]');
  var map = new Map();
  var numAnchors = anchors.length;
  var anchor = null;
  var ancestor = null;
  var previousLength = 0;
  var length = 0;

  for(var i = 0; i < numAnchors; i++) {
    anchor = anchors[i];
    length = textLengths.get(anchor);
    if(!length) continue;
    map.set(anchor, (map.get(anchor) || 0) + length);

    ancestor = anchor.parentElement;
    while(ancestor) {
      previousLength = (map.get(ancestor) || 0);
      map.set(ancestor, previousLength + length);
      ancestor = ancestor.parentElement;
    }
  }
  return map;
}

} // END ANONYMOUS NAMESPACE
