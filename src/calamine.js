// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/utils.js

(function(exports) {
'use strict';

function applyCalamine(document, annotate) {

  let bestElement = fastFindBestElement(document);

  if(!bestElement) {
    const candidates = selectCandidates(document);
    const textLengths = deriveTextLengths(candidates);
    const anchorLengths = deriveAnchorLengths(document, textLengths);
    const textScores = deriveTextScores(candidates, textLengths, anchorLengths);
    const listScores = deriveListScores(candidates);
    const navScores = deriveNavScores(candidates);
    const ancestorScores = deriveAncestorScores(candidates);
    const imageScores = deriveImageScores(document);
    const attributeScores = deriveAttributeScores(candidates);

    if(annotate) {
      for(let entry of textLengths) {
        entry[0].dataset.textLength = entry[1];
      }

      for(let entry of anchorLengths) {
        entry[0].dataset.anchorLength = entry[1];
      }

      for(let entry of textScores) {
        entry[0].dataset.textScore = entry[1];
      }

      for(let entry of listScores) {
        entry[0].dataset.listScore = entry[1];
      }

      for(let entry of navScores) {
        entry[0].dataset.navScore = entry[1];
      }

      for(let entry of ancestorScores) {
        entry[0].dataset.ancestorScore = entry[1];
      }

      for(let entry of imageScores) {
        entry[0].dataset.imageScore = entry[1];
      }

      for(let entry of attributeScores) {
        entry[0].dataset.attributeScore = entry[1];
      }
    }

    // Integrate the scores
    const scores = new Map();
    for(let entry of textScores) {
      scores.set(entry[0], entry[1]);
    }

    for(let entry of listScores) {
      scores.set(entry[0], (scores.get(entry[0]) || 0.0) + entry[1]);
    }

    for(let entry of navScores) {
      scores.set(entry[0], (scores.get(entry[0]) || 0.0) + entry[1]);
    }

    for(let entry of ancestorScores) {
      scores.set(entry[0], (scores.get(entry[0]) || 0.0) + entry[1]);
    }

    for(let entry of imageScores) {
      scores.set(entry[0], (scores.get(entry[0]) || 0.0) + entry[1]);
    }

    for(let entry of attributeScores) {
      scores.set(entry[0], (scores.get(entry[0]) || 0.0) + entry[1]);
    }

    // Find the highest scoring element
    let highScore = 0.0;
    bestElement = document.documentElement;
    for(let entry of scores) {
      if(entry[1] > highScore) {
        bestElement = entry[0];
        highScore = entry[1];
      }
    }
  }

  // Prune
  prune(document, bestElement);
}

function fastFindBestElement(document) {

  const SIGNATURES = [
    'article',
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
    'div[itemtype="http://schema.org/Article"]',
    'div[itemtype="http://schema.org/BlogPosting"]',
    'div[itemtype="http://schema.org/Blog"]',
    'div[itemtype="http://schema.org/NewsArticle"]',
    'div[itemtype="http://schema.org/TechArticle"]',
    'div[itemtype="http://schema.org/ScholarlyArticle"]',
    'div[itemtype="http://schema.org/WebPage"]',
    '#WNStoryBody'
  ];

  for(let i = 0, len = SIGNATURES.length; i < len; i++) {
    const elements = document.querySelectorAll(SIGNATURES[i]);
    if(elements.length === 1) {
      return elements[0];
    }
  }
}

// TODO: use Node.compareDocumentPosition
function prune(document, bestElement) {

  const documentElement = document.documentElement;

  // There is no pruning work to be done if the best element is the root
  if(bestElement === documentElement) {
    return;
  }

  utils.forEach(document.querySelectorAll('*'), function maybePrune(element) {
    // The element is a descendant of an element removed in a prior
    // iteration, ignore it
    if(!documentElement.contains(element)) {
      return;
    }

    // The element is the best element so we must retain
    if(element === bestElement) {
      return;
    }

    // The element is an ancestor of the best element, so we must retain
    if(element.contains(bestElement)) {
      return;
    }

    if(bestElement.contains(element)) {
      // Keep the element unless it is specifically boilerplate
      // For now we just keep
      return;
    }

    // The element does not intersect, remove it
    element.remove();
  });
}

// Measure the text lengths of candidates
function deriveTextLengths(candidates) {
  const result = new Map();
  utils.forEach(candidates, function deriveElementLength(element) {
    //const length = element.textContent.replace(/\s/g, '').length;
    const length = element.textContent.trim().length;
    if(length) {
      result.set(element, length);
    }
  });
  return result;
}

function deriveAnchorLengths(document, textLengths) {
  const result = new Map();
  const anchors = document.querySelectorAll('a[href]');
  utils.forEach(anchors, function measureAnchor(anchor) {
    const length = textLengths.get(anchor);
    for(let node = length ? anchor.parentNode : null; node;
      node = node.parentNode) {
      // TODO: only set if node is a candidate?
      result.set(node, (result.get(node) || 0) + length);
    }
  });
  return result;
}

function selectCandidates(document) {
  return document.querySelectorAll(
    'article, content, div, layer, main, section, span, td');
}

// Calculates and records the text bias for elements. The text bias metric is
// adapted from the paper "Boilerplate Detection using Shallow Text Features".
// See http://www.l3s.de/~kohlschuetter/boilerplate.
function deriveTextScores(candidates, textLengths, anchorLengths) {
  const result = new Map();
  utils.forEach(candidates, function getScore(element) {
    const textLength = textLengths.get(element);
    if(textLength) {
      const anchorLength = anchorLengths.get(element) || 0;
      let weight = (0.25 * textLength) - (0.7 * anchorLength);
      weight = Math.min(4000.0, weight);
      if(weight) {
        result.set(element, weight);
      }
    }
  });
  return result;
}

function deriveListScores(candidates) {
  const result = new Map();
  utils.forEach(candidates, function deriveListScore(element) {
    if(hasListAncestor(element)) {
      result.set(element, -200.0);
    }
  });
  return result;
}

function hasListAncestor(element) {
  // TODO: use element.parentNode as closest includes self?
  return element.closest('li,ol,ul,dd,dl,dt');
}

function hasNavAncestor(element) {
  return element.closest('aside,header,footer,nav,menu,menuitem');
}

function deriveNavScores(candidates) {
  const result = new Map();
  utils.forEach(candidates, function deriveNavScore(element) {
    if(hasNavAncestor(element)) {
      result.set(element, -500.0);
    }
  });
  return result;
}

const ANCESTOR_BIAS = {
  'a': -5.0,
  'aside': -50.0,
  'blockquote': 20.0,
  'br': 3.0,
  'div': -50.0,
  'figure': 20.0,
  'h1': 10.0,
  'h2': 10.0,
  'h3': 10.0,
  'h4': 10.0,
  'h5': 10.0,
  'h6': 10.0,
  'nav': -100.0,
  'ol': -20.0,
  'p': 10.0,
  'pre': 10.0,
  'section': -20.0,
  'ul': -20.0
};


function deriveAncestorScores(candidates) {
  // NOTE: using var due to warning about unsupported compound let assignment
  var result = new Map();
  utils.forEach(candidates, function deriveAncestorScores(element) {
    var bias = 0.0;
    for(var childElement = element.firstElementChild; childElement;
      childElement = childElement.nextElementSibling) {
      bias += ANCESTOR_BIAS[childElement.localName] || 0.0;
    }
    if(bias) {
      result.set(element, bias);
    }
  });
  return result;
}

// TODO: only score parents if they are candidates
function deriveImageScores(document) {
  const result = new Map();
  const images = document.querySelectorAll('img');
  utils.forEach(images, function deriveImageScore(image) {
    let bias = 0.0;
    const parent = image.parentNode;
    bias += image.width && image.height ?
      0.0015 * Math.min(100000, image.width * image.height) : 0.0;
    bias += image.getAttribute('alt') ? 20.0 : 0.0;
    bias += image.getAttribute('title') ? 30.0 : 0.0;
    bias += findImageCaption(image) ? 100.0 : 0.0;

    for(let element = parent.firstElementChild; element;
      element = element.nextElementSibling) {
      if(element !== image && element.localName === 'img') {
        bias -= 50.0;
      }
    }

    if(bias) {
      result.set(parent, (result.get(parent) || 0.0) + bias);
    }
  });
  return result;
}

function findImageCaption(image) {
  const figure = image.closest('figure');
  return figure ? figure.querySelector('figcaption') : null;
}

function deriveAttributeScores(candidates) {
  const result = new Map();
  utils.forEach(candidates, function deriveAttributeScore(element) {
    const tokens = getAttributeTokens(element);
    const bias = getTokenBias(tokens);
    if(bias) {
      result.set(element, bias);
    }
  });
  return result;
}

function getConcatenatedAttributeValues(element) {
  return [
    element.id,
    element.name,
    element.className
  ].join(' ');
}

const WORD_BOUNDARY = /[\s\-_0-9]+/g;

function getAttributeTokens(element) {
  const values = getConcatenatedAttributeValues(element);
  if(values.length < 3)
    return [];
  // TODO: this is all really slow
  const words = values.toLowerCase().split(WORD_BOUNDARY);
  return Array.from(new Set(words));
}

const ATTRIBUTE_BIAS = {
  'ad': -500.0,
  'ads': -500.0,
  'advert': -500.0,
  'article': 500.0,
  'body': 500.0,
  'comment': -500.0,
  'content': 500.0,
  'contentpane': 500.0,
  'gutter': -300.0,
  'left': -50.0,
  'main': 500.0,
  'meta': -50.0,
  'nav': -200.0,
  'navbar': -200.0,
  'newsarticle': 500.0,
  'page': 200.0,
  'post': 300.0,
  'promo': -100.0,
  'rail': -300.0,
  'rel': -50.0,
  'relate': -500.0,
  'related': -500.0,
  'right': -50.0,
  'social': -200.0,
  'story': 100.0,
  'storytxt': 500.0,
  'tool': -200.0,
  'tools': -200.0,
  'widget': -200.0,
  'zone': -50.0
};

function getTokenBias(tokens) {
  // Getting 'Unsupported let compound assignment' warning,
  // reverted to using var
  var bias = 0.0;
  var i = 0;
  var len = tokens.length;
  for(; i < len; i++) {
    bias += (ATTRIBUTE_BIAS[tokens[i]] || 0.0);
  }
  return bias;
}

exports.applyCalamine = applyCalamine;

}(this));
