// See license.md

'use strict';

// TODO: create tests
// TODO: refactor prune to use compareDocumentPosition
// TODO: reintroduce support for annotating output

{ // Begin file scope

// The principle public method of the module. Removes boilerplate from a
// document. Modifies the input object in place because it is not feasible to
// create a new document due to the size of the object.
// Based on boilerpipe an BTE
// http://www.l3s.de/~kohlschuetter/boilerplate
function filterBoilerplate(documentObject) {
  if(!documentObject.body) {
    return;
  }

  const bestElement = findHighScoreElement(documentObject);
  prune(documentObject, bestElement);
}

// Define in outer scope
this.filterBoilerplate = filterBoilerplate;

// Bias parent element score for containing these elements
const ancestorBiasMap = {
  'a': -5,
  'aside': -50,
  'blockquote': 20,
  'br': 3,
  'div': -50,
  'figure': 20,
  'h1': 10,
  'h2': 10,
  'h3': 10,
  'h4': 10,
  'h5': 10,
  'h6': 10,
  'nav': -100,
  'ol': -20,
  'p': 10,
  'pre': 10,
  'section': -20,
  'ul': -20
};

// Bias elements with attribute values containing these tokens
const tokenWeightMap = {
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

// Bias an element based on the text it contains and the ratio of the text
// outside of anchors to text inside of anchors.
// Returns the bias as a double
// For speed this compares approximate char count instead of word count
function deriveTextBias(element) {
  const text = element.textContent.trim();
  const textLength = 0.0 + text.length;
  const anchorLength = 0.0 + deriveAnchorLength(element);
  return (0.25 * textLength) - (0.7 * anchorLength);
}


// Returns the approximate number of characters contained within anchors
// that are descendants of the element. Assumes document is well-formed, meaning
// no nested anchors.
// TODO: use a param 'strict' that if true asserts anchor.closest('a') is
// undefined.
function deriveAnchorLength(element) {
  const anchorList = element.querySelectorAll('a[href]');
  let anchorLength = 0;
  for(let anchor of anchorList) {

    // Adjust the measure of the text within the anchor to ignore
    // some whitespace
    // TODO: ignore all whitespace
    const text = anchor.textContent.trim();

    // NOTE: using long syntax here because I suspect the short syntax is the
    // cause of a strange v8 deopt warning in Chrome 55. Test if this behavior
    // is still present in newer versions of Chrome
    anchorLength = anchorLength + text.length;
  }
  return anchorLength;
}

// Returns the bias for an element based on its child elements
function deriveAncestorBias(element) {
  let totalBias = 0;
  for(let childElement = element.firstElementChild; childElement;
    childElement = childElement.nextElementSibling) {

    const bias = ancestorBiasMap[childElement.localName];

    // Using long syntax due to v8 deopt warning
    if(bias) {
      totalBias = totalBias + bias;
    }
  }

  return totalBias;
}

// Calculates and returns the bias for an element based on the values of
// some of its attributes
// NOTE: Using var due to v8 deopt warnings - Unsupported use of phi const
// NOTE: all helper functions inlined due to function call overhead (for now)
function deriveAttributeBias(element) {
  var totalBias = 0;
  var valsArray = [element.id, element.name, element.className];
  var valsString = valsArray.join(' ');
  if(valsString.length < 3) {
    return totalBias;
  }
  var normValsString = valsString.toLowerCase();
  var tokenArray = normValsString.split(/[\s\-_0-9]+/g);
  var tokenArrayLen = tokenArray.length;
  var seenTokens = {};
  var bias = 0;
  var token;

  for(var i = 0; i < tokenArrayLen; i++) {
    token = tokenArray[i];
    if(!token) {
      continue;
    }

    if(token in seenTokens) {
      continue;
    }

    seenTokens[token] = 1;
    bias = tokenWeightMap[token];

    // NOTE: using long form due to v8 deopt warning
    if(bias) {
      totalBias = totalBias + bias;
    }
  }

  return totalBias;
}

// NOTE: using var due to V8 deopt warning "unsupported compound let statement"
function findHighScoreElement(documentObject) {
  var candidateSelector =
    'article, content, div, layer, main, section, span, td';
  var listSelector = 'li, ol, ul, dd, dl, dt';
  var navSelector = 'aside, header, footer, nav, menu, menuitem';

  // Default the best element to the root of the document
  var bestElement = documentObject.documentElement;

  var body = documentObject.body;
  if(!body) {
    return bestElement;
  }

  var elementList = body.querySelectorAll(candidateSelector);
  var highScore = 0.0;

  for(var element of elementList) {

    var score = 0.0 + deriveTextBias(element);

    if(element.closest(listSelector)) {
      score -= 200.0;
    }

    if(element.closest(navSelector)) {
      score -= 500.0;
    }

    score += deriveAncestorBias(element);
    score += deriveImageBias(element);
    score += deriveAttributeBias(element);

    if(score > highScore) {
      bestElement = element;
      highScore = score;
    }
  }

  return bestElement;
}

// TODO: rather than collect the images, just walk children
function deriveImageBias(parentElement) {
  let bias = 0.0;
  let imageList = findChildImages(parentElement);
  for(let image of imageList) {
    bias += deriveImageAreaBias(image) + deriveImageTextBias(image);
  }
  bias += deriveCarouselBias(imageList);
  return bias;
}

// Returns an array of child image elements
// TODO: revert to basic for loop for speed if perf matters?
// Can i use for..of on childNodes?
// TODO: probably should just deprecate this function and inline it
function findChildImages(element) {
  const nodes = element.childNodes;
  return Array.prototype.filter.call(nodes,
    (node) => node.localName === 'img');
}

// Penalize carousels
function deriveCarouselBias(imageList) {
  let bias = 0;
  const numImages = imageList.length;
  if(numImages > 1) {
    bias = -50 * (numImages - 1);
  }
  return bias;
}

// Reward supporting text of images
function deriveImageTextBias(imageElement) {
  let bias = 0;

  if(imageElement.hasAttribute('alt')) {
    bias += 20;
  }

  if(imageElement.hasAttribute('title')) {
    bias += 30;
  }

  if(findImageCaption(imageElement)) {
    bias += 100;
  }

  return bias;
}

// Reward large images
function deriveImageAreaBias(imageElement) {

  let bias = 0.0;
  const maximumArea = 100000;
  const dampeningCoefficient = 0.0015;
  const area = imageElement.width * imageElement.height;

  if(area) {
    bias = dampeningCoefficient * Math.min(maximumArea, area);
  }

  return bias;
}

function findImageCaption(imageElement) {
  const figureElement = imageElement.closest('figure');
  let captionElement;
  if(figureElement) {
    captionElement = figureElement.querySelector('figcaption');
  }
  return captionElement;
}

// Detach elements that do not intersect with the best element
function prune(documentObject, bestElement) {

  // If the best element is the root element then no need to prune
  if(bestElement === documentObject.documentElement) {
    return;
  }

  // If the best element is at base of all content then no need to prune
  if(bestElement === documentObject.body) {
    return;
  }

  // If for some reason the best element is not a descendant of the root
  // node, then there is no need to prune. This should never happen, because if
  // it does it means this function was called incorrectly, so throw an
  // exception
  if(!documentObject.documentElement.contains(bestElement)) {
    throw new TypeError('best element not attached to document');
  }

  // Walk the dom, removing elements that are not connected to the best element
  const elementList = documentObject.body.querySelectorAll('*');
  for(let element of elementList) {

    // If the element is an ancestor of the best element, then we do not want
    // to remove it
    if(element.contains(bestElement)) {
      continue;
    }

    // If the element is a descendant of the best element, then we do not want
    // to remove it
    if(bestElement.contains(element)) {
      continue;
    }

    // If the element is no longer attached to the document in this moment of
    // iterating, because some ancestor of the element was detached in a prior
    // iteration, then we want to ignore it, because there is no need to
    // detach it
    if(!documentObject.documentElement.contains(element)) {
      continue;
    }

    element.remove();
  }
}

} // End file scope
