// Boilerplate filtering module

import assert from "/src/assert.js";
import {findCaption} from "/src/dom.js";
import {condenseWhitespace} from "/src/string.js";

export default function boilerplateFilter(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const bestElement = findHighScoreElement(doc);
  assert(bestElement);
  prune(doc, bestElement);
}

const ANCESTOR_BIASES = {
  a: -5,
  aside: -50,
  blockquote: 20,
  br: 3,
  div: -50,
  figure: 20,
  h1: 10,
  h2: 10,
  h3: 10,
  h4: 10,
  h5: 10,
  h6: 10,
  nav: -100,
  ol: -20,
  p: 10,
  pre: 10,
  section: -20,
  ul: -20
};

const TOKEN_WEIGHTS = {
  ad: -500,
  ads: -500,
  advert: -500,
  article: 500,
  body: 500,
  comment: -500,
  content: 500,
  contentpane: 500,
  gutter: -300,
  left: -50,
  main: 500,
  meta: -50,
  nav: -200,
  navbar: -200,
  newsarticle: 500,
  page: 200,
  post: 300,
  promo: -100,
  rail: -300,
  rel: -50,
  relate: -500,
  related: -500,
  right: -50,
  social: -200,
  story: 100,
  storytxt: 500,
  tool: -200,
  tools: -200,
  widget: -200,
  zone: -50
};

function deriveTextBias(element) {
  const text = condenseWhitespace(element.textContent);
  const textLength = text.length;
  const anchorLength = deriveAnchorLength(element);
  return 0.25 * textLength - 0.7 * anchorLength;
}

function deriveAnchorLength(element) {
  const anchors = element.querySelectorAll('a[href]');
  let anchorLength = 0;
  for(const anchor of anchors) {
    const text = condenseWhitespace(anchor.textContent);
    anchorLength = anchorLength + text.length;
  }
  return anchorLength;
}

function deriveAncestorBias(element) {
  let totalBias = 0;
  for(let child = element.firstElementChild; child;
    child = child.nextElementSibling) {
    const bias = ANCESTOR_BIASES[child.localName];
    if(bias) {
      totalBias = totalBias + bias;
    }
  }
  return totalBias;
}

function deriveAttributeBias(element) {
  var totalBias = 0;
  var vals = [element.id, element.name, element.className];
  var valsFlatString = vals.join(' ');
  if(valsFlatString.length < 3) {
    return totalBias;
  }

  var normalValsString = valsFlatString.toLowerCase();
  var tokens = normalValsString.split(/[\s\-_0-9]+/g);
  var tokenCount = tokens.length;

  // TODO: use an array instead of an object, this may be the cause of deopts
  var seenTokens = {};
  var bias = 0;
  var token;

  for(var i = 0; i < tokenCount; i++) {
    token = tokens[i];
    if(!token) {
      continue;
    }

    if(token in seenTokens) {
      continue;
    }

    seenTokens[token] = 1;
    bias = TOKEN_WEIGHTS[token];
    if(bias) {
      totalBias = totalBias + bias;
    }
  }

  return totalBias;
}

function findHighScoreElement(doc) {
  var candidateSelector = 'article, content, div, layer, main, section, span, td';
  var listSelector = 'li, ol, ul, dd, dl, dt';
  var navSelector = 'aside, header, footer, nav, menu, menuitem';
  var bestElement = doc.documentElement;
  if(!doc.body) {
    return bestElement;
  }

  var elements = doc.body.querySelectorAll(candidateSelector);
  var highScore = 0;
  for(var element of elements) {
    var score = deriveTextBias(element);
    if(element.closest(listSelector)) {
      score -= 200;
    }

    if(element.closest(navSelector)) {
      score -= 500;
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
  let bias = 0;
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
function deriveImageTextBias(image) {
  let bias = 0;
  if(image.hasAttribute('alt')) {
    bias += 20;
  }

  if(image.hasAttribute('title')) {
    bias += 30;
  }

  if(findCaption(image)) {
    bias += 100;
  }

  return bias;
}

function deriveImageAreaBias(image) {
  let bias = 0;
  const maxArea = 100000;
  const dampCoeff = 0.0015;
  const area = image.width * image.height;
  if(area) {
    bias = dampCoeff * Math.min(maxArea, area);
  }

  return bias;
}

function prune(doc, bestElement) {
  assert(doc.documentElement.contains(bestElement));

  if(bestElement === doc.documentElement) {
    return;
  }

  if(bestElement === doc.body) {
    return;
  }

  const elements = doc.body.querySelectorAll('*');
  for(const element of elements) {
    if(element.contains(bestElement)) {
      continue;
    }

    if(bestElement.contains(element)) {
      continue;
    }

    if(!doc.documentElement.contains(element)) {
      continue;
    }

    element.remove();
  }
}
