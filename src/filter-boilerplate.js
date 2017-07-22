// See license.md

'use strict';

{ // Begin file block scope

function filterBoilerplate(documentObject) {
  if(!documentObject.body) {
    return;
  }

  const bestElement = findHighScoreElement(documentObject);
  prune(documentObject, bestElement);
}

this.filterBoilerplate = filterBoilerplate;

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
  const text = condenseWhitespace(element.textContent);
  const textLength = text.length;
  const anchorLength = deriveAnchorLength(element);
  return (0.25 * textLength) - (0.7 * anchorLength);
}

// Assumes document is well-formed, meaning no nested anchors.
function deriveAnchorLength(element) {
  const anchors = element.querySelectorAll('a[href]');
  let anchorLength = 0;
  for(let anchor of anchors) {
    const text = condenseWhitespace(anchor.textContent);
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
    if(bias) {
      totalBias = totalBias + bias;
    }
  }
  return totalBias;
}

// Calculates and returns the bias for an element based on the values of
// some of its attributes
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

    if(bias) {
      totalBias = totalBias + bias;
    }
  }

  return totalBias;
}

function findHighScoreElement(documentObject) {
  var candidateSelector =
    'article, content, div, layer, main, section, span, td';
  var listSelector = 'li, ol, ul, dd, dl, dt';
  var navSelector = 'aside, header, footer, nav, menu, menuitem';

  var bestElement = documentObject.documentElement;

  var body = documentObject.body;
  if(!body) {
    return bestElement;
  }

  var elementList = body.querySelectorAll(candidateSelector);
  var highScore = 0.0;

  for(var element of elementList) {

    var score = deriveTextBias(element);

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

function deriveImageBias(parentElement) {
  let bias = 0.0;
  let imageCount = 0;
  for(let node of parentElement.childNodes) {
    if(node.localName === 'img') {
      bias += deriveImageAreaBias(node) + deriveImageTextBias(node);
      imageCount++;
    }
  }

  // Penalize carousels
  if(imageCount > 1) {
    bias += -50 * (imageCount - 1);
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

  if(bestElement === documentObject.documentElement) {
    return;
  }

  if(bestElement === documentObject.body) {
    return;
  }

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

function condenseWhitespace(string) {
  return string.replace(/\s+/g, '');
}

} // End file scope
