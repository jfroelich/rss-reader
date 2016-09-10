// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

function filterBoilerplate(document) {
  const bestElement = findHighScoringElement(document);
  prune(document, bestElement);
}

// Returns a measure indicating whether the element contains boilerplate or
// content based on its text. Elements with a large amount of text are
// generally more likely to be content. Elements with a small amount of text
// contained within anchors are more likely to be content.
// The metric is adapted from the paper:
// "Boilerplate Detection using Shallow Text Features".
// See http://www.l3s.de/~kohlschuetter/boilerplate.
function deriveTextBias(element) {
  const text = element.textContent;
  const trimmedText = text.trim();
  const textLength = 0.0 + trimmedText.length;
  const anchorLength = 0.0 + deriveAnchorLength(element);
  return (0.25 * textLength) - (0.7 * anchorLength);
}

// Returns the approximate number of characters contained within anchors that
// are descendants of the element.
// This assumes that the HTML is generally well-formed. Specifically it assumes
// no anchor nesting.
function deriveAnchorLength(element) {
  const anchors = element.querySelectorAll('a[href]');
  const numAnchors = anchors.length;
  let anchorLength = 0;
  for(let i = 0; i < numAnchors; i++) {
    const anchor = anchors[i];
    anchorLength = anchorLength + anchor.textContent.trim().length;
  }
  return anchorLength;
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
const ancestorBiasMap = {
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
function deriveAncestorBias(element) {
  let totalBias = 0;

  for(let child = element.firstElementChild; child;
    child = child.nextElementSibling) {
    const bias = ancestorBiasMap[child.nodeName];

    // Using += seems to cause deopt issues when using let or const (at
    // least in Chrome 49), hence the expanded syntax.
    if(bias) {
      totalBias = totalBias + bias;
    }
  }

  return totalBias;
}

// If one of these tokens is found in an attribute value of an element,
// these bias the element's boilerplate score. A higher score means that the
// element is more likely to be content. This list was created empirically.
const attrTokenWeights = {
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
// NOTE: using var here due to v8 deopt warnings - Unsupported use of phi const
// or something like this, i can't make sense of it
function deriveAttrBias(element) {
  // Start by merging the element's interesting attribute values into a single
  // string in preparation for tokenization.
  // Accessing attributes by property is faster than using getAttribute. It
  // turns out that getAttribute is horribly slow in Chrome. I have not figured
  // out why, and I have not figured out a workaround.
  var valuesArray = [element.id, element.name, element.className];

  // Array.prototype.join implicitly filters null/undefined values so we do not
  // need to check if the property values are defined.
  var valuesString = valuesArray.join(' ');

  // If the element did not have attribute values, then the valuesString
  // variable will only contain whitespace or some negligible token so we exit
  // early to minimize the work done.
  // TODO: maybe I want to declare total bias before this and return total
  // bias here so that I am more consistent about the value returned and its
  // type, so it serves as a better reminder.
  if(valuesString.length < 3) {
    return 0.0;
  }

  // Lowercase the values in one pass. Even though toLowerCase now has to
  // consider extra spaces in its input because it occurs after the join, we
  // don't have to check if inputs are defined non-natively because join did
  // that for us. Also, this is one function call in contrast to 3. toLowerCase
  // scales better with larger strings that the JS engine scales with function
  // calls.
  var lcValuesString = valuesString.toLowerCase();
  var tokenArray = lcValuesString.split(/[\s\-_0-9]+/g);

  // Now add up the bias of each distinct token. Previously this was done in
  // two passes, with the first pass generating a new array of distinct tokens,
  // and the second pass summing up the distinct token biases. I seem to get
  // better performance without creating an intermediate array.

  var tokenArrayLength = tokenArray.length;

  // I use the in operator to test membership which follows the prototype
  // so i think it makes sense to reduce the scope of the lookup by excluding
  // the prototype here (???)
  var seenTokens = Object.create(null);
  var totalBias = 0;
  var bias = 0;
  var token;

  for(var i = 0; i < tokenArrayLength; i++) {
    token = tokenArray[i];

    // Split can yield empty strings for some reason, so skip those.
    if(!token) {
      continue;
    }

    if(token in seenTokens) {
      continue;
    } else {
      seenTokens[token] = 1;
    }

    bias = attrTokenWeights[token];
    if(bias) {
      totalBias += bias;
    }
  }

  return 0.0 + totalBias;
}

// Only these elements are considered as potential best elements
const candidateSelector = [
  'ARTICLE', 'CONTENT', 'DIV', 'LAYER', 'MAIN', 'SECTION', 'SPAN', 'TD'
].join(',');

const listSelector = 'LI, OL, UL, DD, DL, DT';
const navSelector = 'ASIDE, HEADER, FOOTER, NAV, MENU, MENUITEM';

// Scores each of the candidate elements and returns the one with the highest
// score
function findHighScoringElement(document) {

  // Init to documentElement. This ensures we always return something and also
  // sets documentElement as the default best element.
  let bestElement = document.documentElement;

  const body = document.body;
  if(!body) {
    return bestElement;
  }

  const elements = body.querySelectorAll(candidateSelector);
  let highScore = 0.0;
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];

    let score = 0.0 + deriveTextBias(element);

    if(element.closest(listSelector)) {
      score -= 200.0;
    }

    if(element.closest(navSelector)) {
      score -= 500.0;
    }

    score += 0.0 + deriveAncestorBias(element);
    score += deriveImgBias(element);
    score += deriveAttrBias(element);

    if(score > highScore) {
      bestElement = element;
      highScore = score;
    }
  }

  return bestElement;
}

// Derives a bias for an element based on child images
function deriveImgBias(parentElement) {
  let bias = 0.0;
  let numImages = 0;
  let area = 0;

  // Walk the child elements, looking for images
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(element.localName !== 'img') {
      continue;
    }

    // Increase bias for containing a large image
    area = element.width * element.height;
    if(area) {
      bias = bias + (0.0015 * Math.min(100000.0, area));
    }

    // Increase bias for containing descriptive information
    if(element.getAttribute('alt')) {
      bias = bias + 20.0;
    }

    if(element.getAttribute('title')) {
      bias = bias + 30.0;
    }

    if(findImgCaption(element)) {
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

function findImgCaption(image) {
  const figure = image.closest('figure');
  return figure ? figure.querySelector('FIGCAPTION') : null;
}

// Remove elements that do not intersect with the best element
// In order to reduce the number of removals, this uses a contains check
// to avoid removing elements that exist in the static node list but
// are descendants of elements removed in a previous iteration. The
// assumption is that this yields better performance.
// TODO: instead of doing multiple calls to contains, I think I can use one
// call to compareDocumentPosition and then check against its result.
// I am not very familiar with compareDocumentPosition yet, that is the
// only reason I am not using it.
// TODO: this should be a general purpose function named something like
// filterNonIntersectingElements, and it should be in its own file
function prune(document, bestElement) {

  console.assert(document);
  console.assert(bestElement);

  if(bestElement === document.documentElement) {
    return;
  }

  if(!document.body) {
    return;
  }
  const docElement = document.documentElement;
  const elements = document.body.querySelectorAll('*');
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(!element.contains(bestElement) && !bestElement.contains(element) &&
      docElement.contains(element)) {
      element.remove();
    }
  }
}

this.filterBoilerplate = filterBoilerplate;

} // End file block scope
