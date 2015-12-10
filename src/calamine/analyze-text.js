// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Calculates and records the text bias for elements. The text bias metric is
// adapted from the paper "Boilerplate Detection using Shallow Text Features".
// See http://www.l3s.de/~kohlschuetter/boilerplate.

function analyzeText(document, textLengths, anchorLengths) {
  const scores = new Map();

  const elements = document.getElementsByTagName('*');
  const forEach = Array.prototype.forEach;

  // todo: inline this?
  const derive = deriveTextScore.bind(this, scores, textLengths, anchorLengths);
  forEach.call(elements, derive);
  return scores;
}

// Export global
this.analyzeText = analyzeText;

function deriveTextScore(scores, textLengths, anchorLengths, element) {
  const length = textLengths.get(element);
  if(!length) return;
  const anchorLength = anchorLengths.get(element) || 0;
  let weight = (0.25 * length) - (0.7 * anchorLength);
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

this.deriveTextLength = deriveTextLength;

// Generate a map between document elements and a count of
// the characters contained within anchor elements present
// anywhere within the elements


function deriveAnchorLength(document, textLengths) {
  const map = new Map();
  const anchors = document.querySelectorAll('a[href]');
  const numAnchors = anchors.length;

  for(let i = 0, length, previousLength, anchor, ancestor; i < numAnchors;
    i++) {

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

this.deriveAnchorLength = deriveAnchorLength;

} // END ANONYMOUS NAMESPACE
