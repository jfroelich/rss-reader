// See license.md

'use strict';

// Bias parent element score for containing these elements
// TODO: switch back to lowercase and use node.localName to lookup
const jrBPFAncestorBiases = {
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

// Bias elements with attribute values containing these tokens
const jrBPFTokenWeights = {
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

// The principle public method of the module. Removes boilerplate from a
// document
function jrBPFFilterDocument(doc) {
  if(doc.body) {
    const bestElement = jrBPFFindHighScoreElement(doc);
    jrBPFPrune(doc, bestElement);
  }
}

// Bias an element based on the text it contains and the ratio of the text
// outside of anchors to text inside of anchors. See:
// http://www.l3s.de/~kohlschuetter/boilerplate
// Returns the bias as a double
// For speed this compares approximate char count instead of word count
function jrBPFDeriveTextBias(element) {
  const text = element.textContent.trim();
  const textLen = 0.0 + text.length;
  const anchorLen = 0.0 + jrBPFDeriveAnchorLen(element);
  return (0.25 * textLen) - (0.7 * anchorLen);
}

// Returns the approximate number of characters contained within anchors
// that are descendants of the element. Assumes document is well-formed, meaning
// no nested anchors.
// TODO: maybe have a param 'strict' that if true asserts anchor.closest('a') is
// undefined.
function jrBPFDeriveAnchorLen(element) {
  const anchors = element.querySelectorAll('a[href]');
  let anchorLen = 0;
  for(let anchor of anchors) {
    // Using long syntax due to v8 deopt warning
    anchorLen = anchorLen + anchor.textContent.trim().length;
  }
  return anchorLen;
}

// Returns the bias for an element based on its child elements
function jrBPFDeriveAncestorBias(element) {
  let totalBias = 0;
  for(let c = element.firstElementChild; c; c = c.nextElementSibling) {
    const bias = jrBPFAncestorBiases[c.nodeName];
    // Using long syntax due to v8 deopt warning
    if(bias)
      totalBias = totalBias + bias;
  }

  return totalBias;
}

// Calculates and returns the bias for an element based on the values of
// some of its attributes
// Using var due to v8 deopt warnings - Unsupported use of phi const
// All helper functions inlined due to function call overhead (for now)
function jrBPFDeriveAttrBias(element) {
  var totalBias = 0;
  var valsArray = [element.id, element.name, element.className];
  var valsString = valsArray.join(' ');
  if(valsString.length < 3)
    return totalBias;
  var normValsString = valsString.toLowerCase();
  var tokenArray = normValsString.split(/[\s\-_0-9]+/g);
  var tokenArrayLen = tokenArray.length;
  var seenTokens = {};
  var bias = 0;
  var token;

  for(var i = 0; i < tokenArrayLen; i++) {
    token = tokenArray[i];
    if(!token) continue;
    if(token in seenTokens) continue;
    seenTokens[token] = 1;
    bias = jrBPFTokenWeights[token];

    // Using long form due to v8 deopt warning
    if(bias)
      totalBias = totalBias + bias;
  }

  return totalBias;
}

// TODO: switch back to lowercase selects
// Using var due to V8 deopt warning "unsupported compound let statement"
function jrBPFFindHighScoreElement(doc) {
  var candidateSelector =
    'ARTICLE, CONTENT, DIV, LAYER, MAIN, SECTION, SPAN, TD';
  var listSelector = 'LI, OL, UL, DD, DL, DT';
  var navSelector = 'ASIDE, HEADER, FOOTER, NAV, MENU, MENUITEM';

  // Default the best element to the root of the document
  var bestElement = doc.documentElement;

  var body = doc.body;
  if(!body)
    return bestElement;
  var elements = body.querySelectorAll(candidateSelector);
  var highScore = 0.0;

  for(var element of elements) {
    var score = 0.0 + jrBPFDeriveTextBias(element);
    if(element.closest(listSelector))
      score -= 200.0;
    if(element.closest(navSelector))
      score -= 500.0;
    score += jrBPFDeriveAncestorBias(element);
    score += jrBPFDeriveImageBias(element);
    score += jrBPFDeriveAttrBias(element);
    if(score > highScore) {
      bestElement = element;
      highScore = score;
    }
  }

  return bestElement;
}

function jrBPFDeriveImageBias(parentElement) {
  let bias = 0.0;

  // TODO: rather than collect the images, just walk children
  let images = jrBPFGetChildImages(parentElement);
  for(let image of images) {
    bias += jrBPFGetImageAreaBias(image) +
      jrBPFGetImageTextBias(image);
  }
  bias += jrBPFGetCarouselBias(images);
  return bias;
}

// Returns an array of child image elements
// TODO: revert to basic for loop for speed if perf matters?
// Can i use for..of on childNodes?
function jrBPFGetChildImages(element) {
  const nodes = element.childNodes;
  return Array.prototype.filter.call(nodes,
    (node) => node.localName === 'img');
}

// Penalize carousels
function jrBPFGetCarouselBias(images) {
  let bias = 0;
  const numImages = images.length;
  if(numImages > 1)
    bias = -50 * (numImages - 1);
  return bias;
}

// Reward supporting text of images
function jrBPFGetImageTextBias(image) {
  let bias = 0;
  if(image.hasAttribute('alt'))
    bias += 20;
  if(image.hasAttribute('title'))
    bias += 30;
  if(jrBPFFindImageCaption(image))
    bias += 100;
  return bias;
}

// Reward large images
function jrBPFGetImageAreaBias(image) {
  let area = image.width * image.height;
  return area ? 0.0015 * Math.min(100000, area) : 0.0;
}

function jrBPFFindImageCaption(image) {
  const figure = image.closest('figure');
  return figure ? figure.querySelector('figcaption') : undefined;
}

// Detach elements that do not intersect with the best element
function jrBPFPrune(doc, bestElement) {
  const docElement = doc.documentElement;

  if(bestElement === docElement || bestElement === doc.body)
    return;

  // Walk the dom, removing non-intersecting elements
  const elements = doc.body.querySelectorAll('*');
  for(let element of elements) {

    // If an element is not an ancestor of the best element or the best element
    // itself, and not a descendant of the best element or the best element
    // itself, and is still a descendant of the document element, then remove it

    if(!element.contains(bestElement) &&
      !bestElement.contains(element) &&
      docElement.contains(element)) {
      element.remove();
    }
  }
}
