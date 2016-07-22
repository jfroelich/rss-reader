// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Rudimentary lib for filtering boilerplate content from a document. This is
// essentially a document transformation. Given an input document, analyze
// the document's content, and then produce a new document where some of the
// content was filtered. For performance, this modifies the document in place,
// although I am considering generating a new document instead as a part of an
// effort to produce a pure function without side effects.
// The current implementation is pretty simple. The document is viewed as a
// set of data, where nodes represent pieces of content. Each node is given
// a score indicating how likely the node contains content. Then the node
// with the highest score is found, and non-intersecting nodes are removed.
const Calamine = Object.create(null);

Calamine.removeBoilerplate = function(document) {
  let bestElement = Calamine.findHighestScoringElement(document);

  if(bestElement !== document.documentElement) {
    Calamine.prune(document, bestElement);
  }
};

// Returns a measure indicating whether the element contains boilerplate or
// content based on its text. Elements with a large amount of text are
// generally more likely to be content. Elements with a small amount of text
// contained within anchors are more likely to be content.
// The metric is adapted from the paper:
// "Boilerplate Detection using Shallow Text Features".
// See http://www.l3s.de/~kohlschuetter/boilerplate.
Calamine.deriveTextBias = function(element) {
  const text = element.textContent;
  const trimmedText = text.trim();
  const textLength = 0.0 + trimmedText.length;
  const anchorLength = 0.0 + Calamine.deriveAnchorLength(element);
  return (0.25 * textLength) - (0.7 * anchorLength);
};

// Returns the approximate number of characters contained within anchors that
// are descendants of the element.
// This assumes that the HTML is generally well-formed. Specifically it assumes
// no anchor nesting.
Calamine.deriveAnchorLength = function(element) {
  const anchors = element.querySelectorAll('a[href]');
  let anchorLength = 0;
  for(let i = 0, len = anchors.length; i < len; i++) {
    let anchor = anchors[i];
    anchorLength = anchorLength + anchor.textContent.trim().length;
  }
  return anchorLength;
};

// These scores adjust the parent scores of these elements. A parent element
// is more likely to be the best element or a content element when it contains
// several paragraphs and headers. Parents are more likely to be boilerplate
// or not the best element when containing lists, asides, and navigational
// sections.
// The values are empirical.
// Ancestor bias contributes very little to an element's total bias in
// comparision to some of the other biases. The most help comes when there is
// a clear container element of multiple paragraphs.
Calamine.ANCESTOR_BIAS = {
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
Calamine.deriveAncestorBias = function(element) {
  let totalBias = 0;
  let bias = 0;

  // Walk the child elements and sum up each child's bias
  for(let childElement = element.firstElementChild; childElement;
    childElement = childElement.nextElementSibling) {
    bias = Calamine.ANCESTOR_BIAS[childElement.nodeName];

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
};

// If one of these tokens is found in an attribute value of an element,
// these bias the element's boilerplate score. A higher score means that the
// element is more likely to be content. This list was created empirically.
Calamine.ATTRIBUTE_TOKEN_WEIGHTS = {
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
Calamine.deriveAttributeBias = function(element) {
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
  var lowerCaseValuesString = valuesString.toLowerCase();
  var tokenArray = lowerCaseValuesString.split(/[\s\-_0-9]+/g);

  // Now add up the bias of each distinct token. Previously this was done in
  // two passes, with the first pass generating a new array of distinct tokens,
  // and the second pass summing up the distinct token biases. I seem to get
  // better performance without creating an intermediate array.

  var tokenArrayLength = tokenArray.length;
  var seenTokenSet = Object.create(null);
  var totalBias = 0;
  var bias = 0;
  var token;

  for(var i = 0; i < tokenArrayLength; i++) {
    token = tokenArray[i];

    // Split can yield empty strings for some reason, so skip those.
    if(!token) {
      continue;
    }

    if(token in seenTokenSet) {
      continue;
    } else {
      seenTokenSet[token] = 1;
    }

    bias = Calamine.ATTRIBUTE_TOKEN_WEIGHTS[token];
    if(bias) {
      totalBias += bias;
    }
  }

  return 0.0 + totalBias;
};

// Only these elements are considered as potential best elements
Calamine.CANDIDATE_SELECTOR = [
  'ARTICLE', 'CONTENT', 'DIV', 'LAYER', 'MAIN', 'SECTION', 'SPAN', 'TD'
].join(',');

Calamine.LIST_SELECTOR = 'LI, OL, UL, DD, DL, DT';
Calamine.NAV_SELECTOR = 'ASIDE, HEADER, FOOTER, NAV, MENU, MENUITEM';

// Scores each of the candidate elements and returns the one with the highest
// score
Calamine.findHighestScoringElement = function(document) {

  // Init to documentElement. This ensures we always return something and also
  // sets documentElement as the default best element.
  let bestElement = document.documentElement;

  const bodyElement = document.body;
  if(!bodyElement) {
    return bestElement;
  }

  const elementNodeList = bodyElement.querySelectorAll(
    Calamine.CANDIDATE_SELECTOR);
  const listLength = elementNodeList.length;
  let highScore = 0.0;
  for(let i = 0, len = elementNodeList.length; i < len; i++) {
    let element = elementNodeList[i];

    let score = 0.0 + Calamine.deriveTextBias(element);

    if(element.closest(Calamine.LIST_SELECTOR)) {
      score -= 200.0;
    }

    if(element.closest(Calamine.NAV_SELECTOR)) {
      score -= 500.0;
    }

    score += Calamine.deriveAncestorBias(element);
    score += Calamine.deriveImageBias(element);
    score += Calamine.deriveAttributeBias(element);

    if(score > highScore) {
      bestElement = element;
      highScore = score;
    }
  }

  return bestElement;
};

// Derives a bias for an element based on child images
Calamine.deriveImageBias = function(parentElement) {
  let bias = 0.0;
  let numImages = 0;
  let area = 0;

  // Walk the child elements, looking for images
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(element.nodeName !== 'IMG') {
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

    if(Calamine.findImageCaption(element)) {
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
};

// Finds the associated caption element for an image.
Calamine.findImageCaption = function(image) {
  const figure = image.closest('figure');
  return figure ? figure.querySelector('FIGCAPTION') : null;
};

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
Calamine.prune = function(document, bestElement) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }
  const docElement = document.documentElement;
  const elements = bodyElement.querySelectorAll('*');
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(!element.contains(bestElement) && !bestElement.contains(element) &&
      docElement.contains(element)) {
      element.remove();
    }
  }
};
