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
// TODO: support annotation
// TODO: deal with titles remaining in content as a special case.
// TODO: instead of an absolute number, consider treating scores as
// probabilities
// TODO: maybe deprecate the fast method. It has too many edge cases. Instead,
// just heavily bias the signature-matching elements.
// TODO: maybe return to using identified blocks intead of trying to
// find the best root. I am getting too many
// false positives. While the best root is very accurate, there is a lot of
// junk included along with it.
// TODO: maybe instead of pruning doc I can append into a fragment and then
// just return the fragment?

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
// NOTE: not using reduce due to poor readability and performance issues
// TODO: maybe just inline this in the caller.
Calamine.deriveAnchorLength = function(element) {
  const anchors = element.querySelectorAll('a[href]');
  let anchorLength = 0;

  // Not using for .. of due to profiling error NotOptimized TryCatchStatement
  //for(let anchor of anchors) {
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
// TODO: if I stop using the fast path of find-signature and I return to
// individually weighting blocks, I should expand this list.
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
// TODO: Profiling shows a warning about 'Unsupported use of compound let
// statement' again. Revert to using var for now. Figure out why.
Calamine.deriveAttributeBias = function(element) {

  // As much as I would look to organize the statements of this function into
  // smaller helper functions, this is a hotspot, so I have inlined
  // everything. Maybe I can return at a later time and try again once V8
  // stabilizes more.
  // TODO: maybe id and name do not need to be tokenized. I think the spec
  // declares that such values should not contain spaces. On the other hand,
  // what about hyphen or underscore separated terms? If they do not need to
  // be tokenized they could become the first two entries in the token array.
  // I guess it is a question of comparing the desired accuracy to the desired
  // performance.

  // Start by merging the element's interesting attribute values into a single
  // string in preparation for tokenization.
  // Accessing attributes by property is faster than using getAttribute. It
  // turns out that getAttribute is horribly slow in Chrome. I have not figured
  // out why, and I have not figured out a workaround. I forgot to record the
  // testing or cite here.
  var valuesArray = [element.id, element.name, element.className];

  // Array.prototype.join implicitly filters null/undefined values so we do not
  // need to check if the property values are defined.
  var valuesString = valuesArray.join(' ');

  // If the element did not have attribute values, then the valuesString
  // variable will only contain whitespace or some negligible token so we exit
  // early to minimize the work done.
  if(valuesString.length < 3) {
    // TODO: maybe this should return 0 if coercion is the caller's
    // responsibility.
    // TODO: maybe I want to declare total bias before this and return total
    // bias here so that I am more consistent about the value returned and its
    // type, so it serves as a better reminder.
    return 0.0;
  }

  // Lowercase the values in one pass. Even though toLowerCase now has to
  // consider extra spaces in its input because it occurs after the join, we
  // don't have to check if inputs are defined non-natively because join did
  // that for us. Also, this is one function call in contrast to 3. toLowerCase
  // scales better with larger strings that the JS engine scales with function
  // calls.
  var lowerCaseValuesString = valuesString.toLowerCase();

  // Tokenize the values into word-like tokens
  // TODO: why am i even seeing empty strings or whitespace only strings?
  // Think of a way to write the split that excludes these if possible.
  var tokenArray = lowerCaseValuesString.split(/[\s\-_0-9]+/g);

  // Now add up the bias of each distinct token. Previously this was done in
  // two passes, with the first pass generating a new array of distinct tokens,
  // and the second pass summing up the distinct token biases. I seem to get
  // better performance without creating an intermediate array.

  // Avoid calculating loop length per iteration as it is invariant
  var tokenArrayLength = tokenArray.length;

  // The set of seen token strings. I am using a plain object instead of a
  // Set due to performance issues.
  var seenTokenSet = Object.create(null);

  var totalBias = 0;
  var bias = 0;
  var token;

  // TODO: maybe keeping track of the number of tokens added to 'seen' would
  // help reduce the number of calls to 'in'? Similarly, I could also check
  // if i > 0. Because the token will never be in seen in the first iteration.
  // But would that improve the perf? How expensive is 'in'?

  // NOTE: not using for .. of due to performance issues

  for(var i = 0; i < tokenArrayLength; i++) {
    token = tokenArray[i];

    // Split can yield empty strings for some reason, so skip those.
    if(!token) {
      continue;
    }

    // Check if the token is a duplicate
    if(token in seenTokenSet) {
      continue;
    } else {
      // Let later iterations know of the dup
      seenTokenSet[token] = 1;
    }

    // Adjust total bias if there is a bias for the token
    bias = Calamine.ATTRIBUTE_TOKEN_WEIGHTS[token];
    if(bias) {
      totalBias += bias;
    }
  }

  // TODO: maybe type coercion is responsibility of the caller
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

  // NOTE: I am getting a NotOptimized TryCatchStatement when using
  // for .. of. This makes it difficult to profile so I am not using for
  // of for the time being.
  //for(let element of elementNodeList) {

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

// DEPRECATED
// NOTE: we cannot use just article, because it screws up on certain pages.
// This may be a symptom of a larger problem of trying to use a fast path.
// For example, in https://news.vice.com/article/north-korea-claims-new-
// missile-engine-puts-us-within-nuclear-strike-range, it finds
// the one <article> element that isn't the desired best element.
// For now I am using this ugly hack to avoid that one error case. I really
// do not like this and it suggests the entire fast-path thing should be
// scrapped.
Calamine.SIGNATURES = [
  'article:not([class*="ad"])',
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

// DEPRECATED
// Looks for the first single occurrence of an element matching
// one of the signatures
Calamine.findSignature = function(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  // If a signature occurs once in a document, then return it. Use whatever
  // signature matches first in the order defined in Calamine.SIGNATURES
  for(let i = 0, len = Calamine.SIGNATURES.length; i < len; i++) {
    let signature = Calamine.SIGNATURES[i];
    const elements = bodyElement.querySelectorAll(signature);
    if(elements.length === 1) {
      return elements[0];
    }
  }
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
