// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: i am using scores for finding the body for now, but maybe i want to
// express the weights as probabilities instead of magnitudes

{ // BEGIN ANONYMOUS NAMESPACE

function Calamine() {
  this.document = null;
  this.body = null;

  this.textLengths = null;
  this.anchorLengths = null;
  this.bodyTextScores = null;
  this.bodyListDescendantScores = null;
  this.bodyNavDescendantScores = null;
  this.bodyAncestorScores = null;
  this.bodyImageContainerScores = null;
  this.bodyScores = null;

  // TODO: this.bodyAttributeScores

  // TODO: this.boilerplateScores (for elements in this.body)
  // if >=0, its content, otherwise its boilerplate
}

// Export global
this.Calamine = Calamine;

// Analyzes a document. Extracts various features and stores them
// as internal properties.
// NOTE: assumes 'this' is bound to the Calamine instance
Calamine.prototype.analyze = function(document) {
  this.document = document;

  // Only analyze documents with an actual body element. The prune function
  // exits early if bodyElement is not set. We cannot use document.body
  // because that is truthy for non-body elements like frameset.
  if(!document.querySelector('body')) {
    console.debug('calamine: no body element found');
    return;
  }

  // Default the predicted body to the actual body. We only set this after
  // checking for frameset above so that later functions like prune know to
  // exit early by testing if this.body is defined
  this.body = document.body;

  // Do a quick search for a body matching a known signature
  let signatureBody = fastFindBodyElement.call(this);
  if(signatureBody) {
    console.debug('found fast signature body, skipping body analysis');
    this.body = signatureBody;
  }
  else {
    // Extract features indicative of the body
    deriveTextLength.call(this);
    deriveAnchorLength.call(this);
    deriveBodyTextScores.call(this);

    // NOTE: we are only analying body candidates, the types are roughly
    // all treated equally, so unlike prior version, we are not affecting body
    // score with an element type score. when it comes to analyzing individual
    // blocks within the chosen body, there i may want to do a type score.
    // delete this comment once i implement the block scoring.

    deriveBodyListDescendantScores.call(this);
    deriveBodyNavDescendantScores.call(this);
    deriveBodyAncestorScores.call(this);
    deriveBodyImageContainerScores.call(this);

    // TODO: deriveBodyAttributeScores

    deriveBodyScores.call(this);

    // Set this.body to the body candidate with the highest body score
    // NOTE: unlike previous, init to 0, because document.body is not within
    // bodyScores, because document.body is not a candidate, and because
    // we query only under document.body for candidates. This may require more
    // thought in the case that the body element itself should be considered
    // as the potential best body element.
    let bestBodyScore = 0.0;
    for(let entry of this.bodyScores) {
      if(entry[1] > bestBodyScore) {
        this.body = entry[0];
        bestBodyScore = entry[1];
      }
    }
  }

  // Now that we have a body, analyze the elements within the body as
  // individual blocks and determine whether each block is boilerplate or not
  // boilerplate. if positive score, its content, if negative score,
  // its boilerplate.

  // old code to integrate
  //results.boilerplateElements = classifyBoilerplate(results.bodyElement);

};

Calamine.prototype.annotate = function() {

  if(this.textLengths) {
    for(let entry of this.textLengths) {
      entry[0].dataset.textLength = entry[1];
    }
  }

  if(this.anchorLengths) {
    for(let entry of this.anchorLengths) {
      entry[0].dataset.anchorLength = entry[1];
    }
  }

  if(this.bodyTextScores) {
    for(let entry of this.bodyTextScores) {
      entry[0].dataset.bodyTextScore = entry[1];
    }
  }

  if(this.bodyListDescendantScores) {
    for(let entry of this.bodyListDescendantScores) {
      entry[0].dataset.bodyListDescendantScore = entry[1];
    }
  }

  if(this.bodyNavDescendantScores) {
    for(let entry of this.bodyNavDescendantScores) {
      entry[0].dataset.bodyNavDescendantScore = entry[1];
    }
  }

  if(this.bodyAncestorScores) {
    for(let entry of this.bodyAncestorScores) {
      entry[0].dataset.bodyAncestorScore = entry[1];
    }
  }

  if(this.bodyImageContainerScores) {
    for(let entry of this.bodyImageContainerScores) {
      entry[0].dataset.bodyImageContainerScore = entry[1];
    }
  }

  if(this.bodyScores) {
    for(let entry of this.bodyScores) {
      entry[0].dataset.bodyScore = entry[1];
    }
  }

  // Annotate the chosen body as the prediction
  this.body.dataset.predictedBody = 'true';
};

const BODY_SIGNATURES = [
  'article',
  '.hentry',
  '.entry-content',
  '#article',
  '.article',
  '.articleText',
  '.articleBody',
  '#articleBody',
  '.article_body',
  '.articleContent',
  '.full-article',
  '.repository-content',
  '[itemprop="articleBody"]',
  '[role="article"]',
  '[itemtype="http://schema.org/Article"]',
  '[itemtype="http://schema.org/BlogPosting"]',
  '[itemtype="http://schema.org/Blog"]',
  '[itemtype="http://schema.org/NewsArticle"]',
  '[itemtype="http://schema.org/TechArticle"]',
  '[itemtype="http://schema.org/ScholarlyArticle"]',
  '[itemtype="http://schema.org/WebPage"]',
  '#WNStoryBody',

  // todo: verify
  '.WNStoryBody'
];

const NUM_SIGNATURES = BODY_SIGNATURES.length;

// Do a quick search for known, obvious body signatures
function fastFindBodyElement() {
  const body = this.document.body;
  for(let i = 0, elements = null; i < NUM_SIGNATURES; i++) {
    elements = body.querySelectorAll(BODY_SIGNATURES[i]);
    if(elements.length === 1) {
      return elements[0];
    }
  }
}

// Extract character counts per element
// TODO: this should only count characters of candidate elements, not
// all elements, as an optimization? but how would i propagate upward?
function deriveTextLength() {
  this.textLengths = new Map();
  const iterator = this.document.createNodeIterator(
    this.document.documentElement, NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  let length = 0;
  let element = null;
  let previousLength = 0;
  while(node) {
    length = getNodeTextLength(node);
    if(length) {
      element = node.parentElement;
      while(element) {
        previousLength = this.textLengths.get(element) || 0;
        this.textLengths.set(element, previousLength + length);
        element = element.parentElement;
      }
    }

    node = iterator.nextNode();
  }
}

const RE_WHITESPACE = /\s|&nbsp;/g;

// Gets a representation of the number of characters for a text node
function getNodeTextLength(node) {
  const value = node.nodeValue;
  let length = 0;
  // Avoid the overhead of the regular expression by checking for
  // various frequently occurring trivial text values
  if(value !== '\n' && value !== '\n\t' && value !== '\n\t\t') {
    // Get the length of the string without whitespace
    length = value.replace(RE_WHITESPACE, '').length;
  }

  return length;
}

// Generate a map between document elements and a count of
// the characters contained within anchor elements present
// anywhere within the elements.
function deriveAnchorLength() {

  // NOTE: this double counts in the case of malformed HTML containing nested
  // anchors. for now this case is ignored.

  this.anchorLengths = new Map();
  const anchors = this.document.querySelectorAll('a[href]');
  const numAnchors = anchors.length;

  for(let i = 0, length, previousLength, anchor, ancestor; i < numAnchors;
    i++) {

    anchor = anchors[i];
    length = this.textLengths.get(anchor);
    if(!length) continue;

    // TODO: if i only care about anchor lengths for candidate elements,
    // and so because an anchor is not a candidate, this may be pointless?
    this.anchorLengths.set(anchor,
      (this.anchorLengths.get(anchor) || 0) + length);

    ancestor = anchor.parentElement;
    while(ancestor) {
      previousLength = (this.anchorLengths.get(ancestor) || 0);
      this.anchorLengths.set(ancestor, previousLength + length);
      ancestor = ancestor.parentElement;
    }
  }
}

function selectBodyCandidates(document) {
  // note: this only selects candidates WITHIN document.body, it excludes
  // document.body itself as a candidate
  // NOTE: maybe this should access a Set instead of hardcoding the query
  return document.body.querySelectorAll(
    'article, content, div, layer, main, section, td');
}

// Calculates and records the text bias for elements. The text bias metric is
// adapted from the paper "Boilerplate Detection using Shallow Text Features".
// See http://www.l3s.de/~kohlschuetter/boilerplate. This only looks at
// character counts, this views elements as text blocks, this only looks at
// certain elements (body candidates)
function deriveBodyTextScores() {

  // NOTE: unlike prior versions, this only sets scores on those elements
  // that could be the body

  this.bodyTextScores = new Map();
  const elements = selectBodyCandidates(this.document);
  const numElements = elements.length;
  for(let i = 0, element, length, anchorLength, weight; i < numElements; i++) {
    element = elements[i];
    length = this.textLengths.get(element);
    if(!length) continue;
    anchorLength = this.anchorLengths.get(element) || 0;
    weight = (0.25 * length) - (0.7 * anchorLength);
    weight = Math.min(4000.0, weight);
    if(!weight) continue;
    this.bodyTextScores.set(element,
      (this.bodyTextScores.get(element) || 0.0) + weight);
  }
}

function isBodyCandidateListDescendant(element) {
  let ancestor = element.parentElement;
  let name = null;
  while(ancestor) {

    name = ancestor.localName;

    if(name === 'li' || name === 'ol' || name === 'ul' ||
      name === 'dd' || name === 'dl' || name === 'dt') {
      return true;
    }

    ancestor = ancestor.parentElement;
  }

  return false;
}

function deriveBodyListDescendantScores() {
  this.bodyListDescendantScores = new Map();
  const elements = selectBodyCandidates(this.document);
  const numElements = elements.length;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(isBodyCandidateListDescendant(element)) {
      this.bodyListDescendantScores.set(element, -200.0);
    }
  }
}

function isBodyCandidateNavDescendant(element) {
  let ancestor = element.parentElement;
  let name = null;
  while(ancestor) {
    name = ancestor.localName;
    if(name === 'aside' || name === 'header' || name === 'footer' ||
      name === 'nav' || name === 'menu' || name === 'menuitem') {
      return true;
    }

    ancestor = ancestor.parentElement;
  }

  return false;
}

function deriveBodyNavDescendantScores() {
  this.bodyNavDescendantScores = new Map();
  const elements = selectBodyCandidates(this.document);
  const numElements = elements.length;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(isBodyCandidateNavDescendant(element)) {
      this.bodyNavDescendantScores.set(element, -500.0);
    }
  }
}

// Bias parent body candidate elements for containing these elements
// as immediate children
// NOTE: this may need some refinement because it can heavily promote a
// nested div of the main div which results in the best body not including
// things like mastheads (an article's main introductory image)
const UPWARD_BIAS = new Map([
  ['a', -5.0],
  ['aside', -50.0],
  ['blockquote', 20.0],
  ['br', 3.0],
  ['div', -50.0],
  ['figure', 20.0],
  ['h1', 10.0],
  ['h2', 10.0],
  ['h3', 10.0],
  ['h4', 10.0],
  ['h5', 10.0],
  ['h6', 10.0],
  ['li', -5.0],
  ['nav', -100.0],
  ['ol', -20.0],
  ['p', 100.0],
  ['pre', 10.0],
  ['section', -20.0],
  ['ul', -20.0]
]);

function deriveBodyAncestorScores() {
  this.bodyAncestorScores = new Map();

  // Promote body candidate elements for containing certain elements
  const elements = selectBodyCandidates(this.document);
  const numElements = elements.length;
  let childNodes = null;
  let numChildren = 0;
  let j = 0;
  let child = null;
  let bias = 0.0;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    childNodes = element.childNodes;
    numChildren = childNodes.length;
    for(j = 0; j < numChildren; j++) {
      child = childNodes[j];
      if(child.nodeType === Node.ELEMENT_NODE) {
        bias = UPWARD_BIAS.get(child.localName);
        if(bias) {
          this.bodyAncestorScores.set(element,
            (this.bodyAncestorScores.get(element) || 0.0) + bias);
        }
      }
    }
  }
}

function imageParentIsBodyCandidate(element) {
  // TODO: eventually remove the DRY violation with selectBodyCandidates
  // and hoist the invariant into outer scope, and maybe even just
  // deprecate this function at that point since it is so simple
  const candidateNames = new Set([
    'article',
    'content',
    'div',
    'layer',
    'main',
    'section',
    'td'
  ]);
  return candidateNames.has(element.localName);
}


// TODO: this works, but not quite like I want. I think I need to propagate
// farther up the hierarchy, because the immediate ancestor is sometimes
// an extra nested non-candidate div. When there is that extra nesting, it
// seems like the typical case that the masthead image gets excluded because
// another nested div containing most of the text content gets picked as the
// body.
// TODO: actually not sure this works, need to test more
function deriveBodyImageContainerScores() {
  this.bodyImageContainerScores = new Map();

  const images = this.document.getElementsByTagName('img');
  const numImages = images.length;
  let imageParent = null;
  let bias = 0.0;
  let area = 0.0;
  let caption = null;
  let children = null;
  let numChildren = 0;
  let j = 0;
  for(let i = 0, image; i < numImages; i++) {
    image = images[i];
    imageParent = image.parentElement;

    if(!imageParent) {
      continue;
    }

    // Check that the imageParent is a body candidate
    if(!imageParentIsBodyCandidate(imageParent)) {
      continue;
    }

    bias = 0.0;

    // Dimension bias
    if(image.width && image.height) {
      area = image.width * image.height;
      bias += 0.0015 * Math.min(100000, area);
    }

    // Description bias
    // TODO: check data-alt and data-title?
    if(image.getAttribute('alt')) {
      bias += 20.0;
    }

    if(image.getAttribute('title')) {
      bias += 30.0;
    }

    caption = DOMUtils.findCaption(image);
    if(caption) {
      bias += 100.0;
    }

    // Carousel bias
    children = imageParent.childNodes;
    numChildren = children.length;
    for(j = 0; j < numChildren; j++) {
      node = children[j];
      if(node !== image && node.localName === 'img') {
        bias = bias - 50.0;
      }
    }

    if(bias) {
      this.bodyImageContainerScores.set(imageParent,
        (this.bodyImageContainerScores.get(imageParent) || 0.0) + bias);
    }
  }
}

// Sum up the other scores that influence the bodyScore for each body
// candidate element
function deriveBodyScores() {
  this.bodyScores = new Map();

  for(let entry of this.bodyTextScores) {
    this.bodyScores.set(entry[0],
      (this.bodyScores.get(entry[0]) || 0.0) + entry[1]);
  }

  for(let entry of this.bodyListDescendantScores) {
    this.bodyScores.set(entry[0],
      (this.bodyScores.get(entry[0]) || 0.0) + entry[1]);
  }

  for(let entry of this.bodyNavDescendantScores) {
    this.bodyScores.set(entry[0],
      (this.bodyScores.get(entry[0]) || 0.0) + entry[1]);
  }

  for(let entry of this.bodyAncestorScores) {
    this.bodyScores.set(entry[0],
      (this.bodyScores.get(entry[0]) || 0.0) + entry[1]);
  }

  for(let entry of this.bodyImageContainerScores) {
    this.bodyScores.set(entry[0],
      (this.bodyScores.get(entry[0]) || 0.0) + entry[1]);
  }
}

} // END ANONYMOUS NAMESPACE
