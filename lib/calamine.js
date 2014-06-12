/**
 * Copyright 2014 Josh Froelich. MIT licensed.
 *
 * A simple module for removing boilerplate from web pages.
 */
var calamine = (function(exports, each, filter) {
'use strict';

var options = {
  SHOW_SCORE: 1
};

/**
 * Apply calamine to an HTMLDocument object.
 */
function transformDocument(doc) {

  preprocessDocument(doc);
  extractFeatures(doc);
  each(gebn(doc.body), scoreElement);
  each(gebn(doc.body), applySiblingBias);

  if(options.SHOW_SCORE) {
    each(gebn(doc.body), function(element) {
      element.setAttribute('score', element.score.toFixed(2));
    });
  }

  var bestElement = findBestElement(doc);
  if(bestElement == doc) {
    doc.body.style.border = '2px solid green';
  } else {
    bestElement.style.border = '2px solid green';  
  }

  return bestElement;
}

/**
 * Strip out some unwanted stuff. Split up BR and HR.
 */
function preprocessDocument(doc) {
  
  // This is not meant to be complete, see sanitizer for more complete list.
  // Might move this out of here too.
  var BAD_TAG_SELECTOR = 'button,select,option,input,applet,head,form,'+
    'script,iframe,noscript,object,embed,frame,frameset,style';

  // Strip out some tags here while in development. The plan is to figure out the 
  // coupling with the sanitizer later but its completely independent now so we 
  // need to do this.
  each(doc.querySelectorAll(BAD_TAG_SELECTOR), removeElement);
  
  // Strip attributes of tags
  each(gebn(doc), filterAttributes);

  // Replace rules with paragraphs
  //var p = doc.createElement('p');
  each(doc.querySelectorAll('hr,br'), function(node) {
    //node.parentNode.replaceChild(p,node);
    node.parentNode.replaceChild(doc.createElement('p'),node);
  });

  // Strip most empty elements (other than images)
  filter(gebn(doc), isEmptyElement).forEach(removeElement);

  // Strip out hidden comment nodes
  // Larrgely just for development purposes while reviewing raw html
  var comment, commentIt = doc.createNodeIterator(doc,NodeFilter.SHOW_COMMENT);
  while(comment = commentIt.nextNode()) {
    comment.parentNode.removeChild(comment);
  }
}

/**
 * Extracts text, anchor and image features and stores them as properties 
 * in the native dom. The properties are then propagated upward to doc.body
 * using sum.
 */
function extractFeatures(doc) {

  // Define the root element. Bottom up property propagation will always 
  // stop before reaching this depth of the hierarchy. Only elements within
  // this root are analyzed. Top down propagation starts from the children 
  // of this element and does not include the element itself.
  var root = doc.body;

  // Propagate cardinality (note: make sure to deprecate if 
  // I end up not using element density bias)
  each(gebn(root), function(element) {
    var cardinality = gebn(element).length;
    if(cardinality) {
      element.cardinality = cardinality;
    }
  });

  // Propagate image metrics
  // TODO: use diff weights for image dimensions? the larger the 
  // area, the larger the score, because the image takes up 
  // more space on the screen, and is therefore more likely to be 
  // related to content. e.g. infographics stuff.
  
  // I think what we want is this. imageArea property. If width and 
  // height are accessible from attributes or style, calculate area
  // and store that. if not accessible assume 100x100 or something.
  // then, instead of propagating image count, propagate image area.
  // this is more visual and differentiates images from one another,
  // and in the worst case of implicit dimensions (which we cannot 
  // get because this is all prerender in a detached content)
  // every image is treated the same by using the default area.
  // NOTE: clamp area to 800x600.
  // NOTE: penalize 1x1 (matches signature of hidden image tracking)

  each(root.getElementsByTagName('img'), function(image) {
    if(!image.hasAttribute('src')) return;
    //image.imageCount = 1;
    var parentElement = image.parentElement;
    while(parentElement != root) {
      parentElement.imageCount = parentElement.imageCount ?
        parentElement.imageCount + 1 : 1;
      parentElement = parentElement.parentElement;
    }
  });

  // Propagate text metrics
  var textNode, textIterator = doc.createNodeIterator(root, NodeFilter.SHOW_TEXT);
  var value, charCount;
  while(textNode = textIterator.nextNode()) {
    // nodeValue is guaranteed defined for textNode
    value = textNode.nodeValue.trim();
    // Many text nodes are whitespace. Rather than 
    // pruning, we simply ignore them. Pruning would help slightly for 
    // compression but not here.
    if(!value) continue;

    // Note: rather than count words, I am experimenting with 
    // simply using character count. Note that we could alternatively
    // to a top down pass that simply uses textContent.trim().length.
    // But for now my gut tells me that textContent is expensive. Need 
    // to perf test.
    // Note: because we trimmed, do not forget that char count is not exactly 
    // equal to nodeValue.length.
    // Note: we could slightly improve the metric, if we wanted, by 
    // subtracing the number of non-token-like characters. But for now 
    // I think it is not important. Something like:
    // value.length - value.split(/[\s\.]/g).length;
    // Note: if i do this it should be merged into the trim call 
    // above.
    // For now just use raw length. We know now that text length is > 0 
    // because empty string is falsy (so !value would be true)
    charCount = value.length;
    var parentElement = textNode.parentElement;
    while(parentElement != root) {
      parentElement.charCount = parentElement.charCount ?
        parentElement.charCount + charCount : charCount;
      parentElement = parentElement.parentElement;
    }

    if(/[©]|&copy;|&#169;/i.test(value)) {
      parentElement.copyrightCount = 1;
    }
  }

  // Propagate anchor metrics
  each(root.getElementsByTagName('a'), function(anchor) {
    var chars = anchor.charCount;
    if(!chars) return;
    if(!anchor.hasAttribute('href')) return;
    
    anchor.anchorCharCount = chars;

    var parentElement = anchor.parentElement;
    while(parentElement != root) {
      parentElement.anchorCharCount = parentElement.anchorCharCount ?
        parentElement.anchorCharCount + chars : chars;
      parentElement = parentElement.parentElement;
    }
  });
}

function scoreElement(element) {
  element.score = element.score || 0;
  element.score += getAnchorDensityBias(element);
  element.score += getTextDensityBias(element);
  element.score += getCopyrightBias(element);
  element.score += getPositionBias(element);
  element.score += getTagNameBias(element);
  element.score += getAttributeBias(element);

  // Bias all of the descendants of certain ancestor elements
  var ancestorBias = ANCESTOR_BIAS[element.localName];
  if(isFinite(ancestorBias)) {
    each(gebn(element), function(childElement) {
      childElement.score = childElement.score || 0;
      childElement.score += ancestorBias;
    });
  }

  // Bias the immediate ancestor of certain descendant elements
  var descendantBias = DESCENDANT_BIAS[element.localName];
  if(isFinite(descendantBias)) {
    var parentElement = element.parentElement;
    var rootElement = element.ownerDocument.body;
    if(parentElement != rootElement) {
      parentElement.score = parentElement.score || 0;
      parentElement.score += descendantBias;
    }
  }
}

function getAnchorDensityBias(element) {
  // Anchor density is on a scale of 0 to 1, where 1 represents
  // high density, and therefore probably boilerplate. The closer 
  // to 0, the more likely it is content.
  var charCount = element.charCount || 0;
  var anchorCharCount = element.anchorCharCount || 0;
  var score = 0;
  if(element.anchorCharCount && element.charCount) {
    var anchorDensity = element.anchorCharCount / element.charCount;
    if(anchorDensity > 0.35) {
      score -= 100;
    } else {
      score += 100;
    }
  }

  return score;
}

function getTextDensityBias(element) {
  //var cardinality = element.cardinality || 0;
  var score = 0;

  if(element.localName != 'img' && element.charCount) {
    var textDensity = (element.charCount || 0) / (element.cardinality || 1);
    if(textDensity > 10.5) {
      score += 100;
    } else if(textDensity > 7) {
      score += 20;
    } else {
      score -= 100;
    }
  }

  return score;  
}

function getCopyrightBias(element) {
  // Copyright bias. Experimental.Consider abstracting this a bit to 
  // count|non-text|symbols|that|frequently|appear|in|boilerplate.
  var score = 0;
  if(element.copyrightCount) {
    score -= 10;
  }
  return score;
}

function getPositionBias(element) {
  // Elements closer to the top or middle are gently promoted
  var siblingCount = element.parentElement.childElementCount - 1, score = 0, 
    previousSiblingCount = 0, sibling, startOffsetBias, 
    halfSiblingCount, midOffsetBias;

  if(!siblingCount) return score;

  sibling = element.previousElementSibling;
  while(sibling) {
    previousSiblingCount++;
    sibling = sibling.previousElementSibling;
  }

  startOffsetBias = 2 - 2 * previousSiblingCount / siblingCount;
  score += startOffsetBias;
  halfSiblingCount = siblingCount / 2;
  midOffsetBias = 2 - 2 * (Math.abs(previousSiblingCount - halfSiblingCount) / halfSiblingCount);
  score += midOffsetBias;
  return score;
}

function getTagNameBias(element) {
  // Bias certain elements
  var score = 0;
  var tagNameBias = TAG_NAME_BIAS[element.localName];
  if(isFinite(tagNameBias)) {
    score += tagNameBias;
  }
  return score;
}

function getAttributeBias(element) {
  // Bias by id or class attribute value
  var attributeText = ((element.rawId || '') + ' ' + (element.rawClass || '')).trim();
  var score = 0;
  if(attributeText) {
    if(RE_POSITIVE_CLASS.test(attributeText)) {
      score += 25;
    } else if(RE_NEGATIVE_CLASS.test(attributeText)) {
      score -= 25;
    }
  }
  return score;
}

var POSITIVE_CLASS_TOKEN = [
 'article','author','body','byline',
 'attachment','content','carousel',
 'entry','main','post','text','blog','story'];
var NEGATIVE_CLASS_TOKEN = [
  'about','ad-','ads','advert','branding','button','comment',
  'component','contact','facebook','foot','footer','footnote',
  'google','header','insta','left','linkedin','links','logo',
  'mainNav','menu','navbar','parse','powered','promo','recap',
  'related','right','scroll','share','shoutbox','sidebar',
  'social','sponsor','shopping','tags','tool','twitter','week',
  'widget','zone'];
var RE_POSITIVE_CLASS = new RegExp(POSITIVE_CLASS_TOKEN.join('|'),'i');
var RE_NEGATIVE_CLASS = new RegExp(NEGATIVE_CLASS_TOKEN.join('|'),'i');

/**
 * Propagate scores to nearby siblings. Look up to 2 elements 
 * away in either direction. The idea is that content generally
 * follows content, and boilerplate generally follows boilerplate.
 * Contiguous blocks should get promoted by virture of their 
 * context.
 */
function applySiblingBias(element) {
  var elementBias = element.score > 0 ? 3 : -3;
  var sibling = element.previousElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    if(Math.abs(sibling.score - element.score) < 20) {
      sibling.score += elementBias;
    }
    sibling = sibling.previousElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      if(Math.abs(sibling.score - element.score) < 20) {
        sibling.score += elementBias;
      }
    }
  }

  sibling = element.nextElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    if(Math.abs(sibling.score - element.score) < 20) {
      sibling.score += elementBias;
    }
    sibling = sibling.nextElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      if(Math.abs(sibling.score - element.score) < 20) {
        sibling.score += elementBias;
      }
    }
  }
}

/**
 * Returns the best element in the document or falls back
 * to document.
 */
function findBestElement(doc) {
  // TODO: handling leading/trailing boilerplate
  // TODO: including other high scoring sections near the main
  var maxElement, maxScore = 0;
  each(gebn(doc.body), function(element) {
    if(element.score > maxScore) {
      maxScore = element.score;
      maxElement = element;
    }
  });

  if(!maxElement) {
    maxElement = doc;
  }

  return maxElement;
}

/**
 * These elements generally represent content that should signify 
 * that the containing element is a content container. Reward all
 * ancestors for containing these elements.
 */
var DESCENDANT_BIAS = {
  p:3, h1:1, h2:1, h3:1, h4:1, h5:1, h6:1, blockquote:3,
  sub:2, sup:2, pre:2, code:2, time:2, span:1, i:1, em:1,
  strong:1, b:1
};

var ANCESTOR_BIAS = {
  nav:-20, div:1, header:-5, table:-2, ol:-5, ul:-5, li:-3,
  dl:-5, p:10, blockquote:10, pre:10, code:10
};

var TAG_NAME_BIAS = {
  a:-1, address:-3, article:30, blockquote:3, button:-100, dd:-3,
  div:5, dl:-10, dt:-3, footer:-20, font:0, form: -3, header: -5,
  h1: -2, h2: -2, h3: -2, h4: -2, h5: -2, h6: -2, li: -10, nav: -50,
  ol:-20, p:10, pre:3, section:10, td:3, time:0, tr:1, th:-3, ul:-20
};

function postprocessDocument(doc) {
  // TODO: move strip attributes from preprocess to postprocses
  //each(doc.querySelectorAll('div,span'), unwrapElement);
  //each(doc.querySelectorAll('span'), unwrapElement);
}

function gebn(element) {
  return element.getElementsByTagName('*');
}

/**
 * Clean up the attributes for a node.
 */
function filterAttributes(node) {
  // node.attributes is a live list, so we create a static
  // list then iteratively remove its items.
  var removableAttributes = [];
  filter(node.attributes, isNotRetainableAttribute).forEach(
  function(attribute) {
    //node.removeAttribute(attribute.name);
    node.removeAttributeNode(attribute);
  });

  // Strip out id and class. Note that this is just for dev. In the 
  // future we should strip them out and store them as hidden 
  // properties in the native node object. But for class/id tag
  // weighting I want to review them easily within the raw HTML for 
  // now.
  var rawId = node.getAttribute('id');
  
  if(rawId) {
    node.rawId = rawId;
    node.removeAttribute('id');
  }

  var rawClass = node.getAttribute('class');
  if(rawClass) {
    node.rawClass = rawClass;
    node.removeAttribute('class');
  }
}

var RETAINABLE_ATTRIBUTE = {id:1,class:1,href:1,src:1};
function isNotRetainableAttribute(attribute) {
  return !RETAINABLE_ATTRIBUTE[attribute.name];
}

function isEmptyElement(element) {
  
  // Carve out an exception for images.
  if(element.localName == 'img') {
    return;
  }

  var childNodeCount = element.childNodes.length;

  // Note: the following still fails sometimes when there 
  // are multiple text nodes.

  if(childNodeCount == 1 && element.firstChild.nodeType == Node.TEXT_NODE) {
    // If there is one child text node, then 
    // we know there are no further descendants. 
    // Return true if it has no length after trimming.
    return  !element.firstChild.nodeValue.trim().length;
  } 

  return !childNodeCount;
}

function unwrapElement(element) {
  while(element.firstChild) {
    element.parentNode.insertBefore(element.firstChild, element);
  }

  element.parentNode.removeChild(element);  
}

function removeElement(element) {
  if(element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

return {
  transform: transformDocument,
  options: options
};

}(this, util.each, util.filter));