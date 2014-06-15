/**
 * Copyright 2014 Josh Froelich. MIT licensed.
 *
 * A simple module for removing boilerplate from web pages.
 *
 * TODO: introduce support for iframes
 * TODO: include other proximate or high scoring elements outside of the 
 * best element, then rescan and filter out any extreme boilerplate 
 * such as certain lists or ads. When building the frag, consider removing
 * each element from the original body such that each successive search for 
 * another element does not have perform intersection tests.
 * TODO: performance testing, memory testing
 * TODO: if no longer using cardinality, deprecate it. need to wait 
 * until more testing is done using new model.
 * Thoughts on image scoring.  use diff weights for image dimensions? 
 * the larger the area, the larger the score, because the image takes up 
 * more space on the screen, and is therefore more likely to be 
 * related to content. e.g. infographics stuff.
 * I think what we want is this. imageArea property. If width and 
 * height are accessible from attributes or style, calculate area
 * and store that. if not accessible assume 100x100 or something.
 * then, instead of propagating image count, propagate image area.
 * this is more visual and differentiates images from one another,
 * and in the worst case of implicit dimensions (which we cannot 
 * get because this is all prerender in a detached content)
 * every image is treated the same by using the default area.
 * TODO: clamp area to 800x600 when doing the calculation (do not 
 * change the attribute, just make sure to avoid using a giant area in 
 * the calculation itself)
 * Also: another obvious image weighting technique is alt/title text.
 */
var calamine = (function(exports) {
'use strict';

/** Remove these elements, including children */
var SELECTOR_REMOVABLE = 'applet,base,basefont,button,command,datalist,'+
'dialog,embed,fieldset,frame,frameset,head,iframe,img:not([src]),input,'+
'link,math,meta,noframes,object,option,optgroup,output,param,script,'+
'select,style,title,textarea',

/** Remove these elements, excluding children, if OPTIONS.UNWRAP_UNWRAPPABLE is set */
SELECTOR_UNWRAPPABLE = 'a:not([href]),body,center,div,font,form,html,legend,span',

/**
 * Elements that should not be considered empty nor containing scorable text
 */
SELECTOR_LEAFY = 'applet,audio,br,canvas,embed,frame,hr,iframe,img,object,video',

SELECTOR_INLINE = 'a,abbr,acronym,b,bdo,big,cite,code,dfn,'+
'em,kbd,i,q,samp,small,span,strong,sub,sup,tt,var',

SELECTOR_INLINE_SEPARATOR = 'br,hr',

/** Bias lookup table for getTagNameBias */
TAG_NAME_BIAS = {
  a:-1, address:-3, article:100, blockquote:3, button:-100, dd:-3,
  div:20, dl:-10, dt:-3, footer:-20, font:0, form: -3, header: -5,
  h1: -2, h2: -2, h3: -2, h4: -2, h5: -2, h6: -2, li: -20, nav: -50,
  ol:-20, p:10, pre:3, section:10, small:-1,td:3, time:0, tr:1, th:-3, ul:-20},

ID_CLASS_BIAS = {
  about: -35, 'ad-': -100, ads: -50, advert: -100, article: 100,
  attachment: 20, author: 20, blog: 20, body: 50, brand: -50,
  button: -100, byline: 20, carousel: 30, comic: 75,
  comment: -300, component: -50, contact: -50, content: 50,
  dcsimg: -100,
  entry: 50, excerpt: 20, facebook: -100, foot: -100, google: -50, 
  head: -50, insta: -100, left: -75, link: -100, logo: -50, main: 50,
  menu: -200, meta: -50, nav: -200, parse: -50, pinnion: 50,
  post: 50, power: -100, promo: -200, recap: -100, relate: -300, 
  right: -100, scroll: -50, share: -200, shop: -200, shout: -200, 
  side: -200, sig: -50, social: -200, sponsor: -200, story: 20, tag: -100, 
  text: 20, title: -100,tool: -200, twitter: -200, txt: 50, 
  week: -100, widg: -200, zone: -50
},

/** get an array for fast iteration */
ID_CLASS_KEYS = Object.keys(ID_CLASS_BIAS),

/** get an array for faster lookup (??) */
ID_CLASS_VALUES = ID_CLASS_KEYS.map(function(key) {
  return ID_CLASS_BIAS[key];
}),

/** Immediate parent elements are biased for containing these elements. */
DESCENDANT_BIAS = {
  p:5, h1:1, h2:1, h3:1, h4:1, h5:1, h6:1, blockquote:3,
  sub:2, sup:2, pre:2, code:2, time:2, span:1, i:1, em:1,
  strong:1, b:1},

/** These ancestor elements bias all descendants. */
ANCESTOR_BIAS = {
  nav:-20, div:1, header:-5, table:-2, ol:-5, ul:-5, li:-3,
  dl:-5, p:10, blockquote:10, pre:10, code:10};

/** public API */
return {
  transform: transformDocument
};

/**
 * Returns the most coherent element(s) in an HTMLDocument object
 */
function transformDocument(doc, options) {

  options = options || {};

  each(doc.body.querySelectorAll(SELECTOR_REMOVABLE), removeNode);
  eachNode(doc.body, NodeFilter.SHOW_COMMENT, removeNode);
  each(doc.body.querySelectorAll('*'), filterInvisibleElement);
  each(doc.body.querySelectorAll('img'), filter1DImage);

  // Always unwrap noscript.
  each(doc.body.querySelectorAll('noscript'), unwrapElement);

  each(doc.body.querySelectorAll(SELECTOR_INLINE_SEPARATOR), transformRuleElement);
  each(doc.body.getElementsByTagName('pre'), cascadeWhitespaceImportant);
  each(doc.body.getElementsByTagName('code'), cascadeWhitespaceImportant);
  eachNode(doc.body, NodeFilter.SHOW_TEXT, trimAndMaybeRemoveTextNode);
  pruneEmptyElements(doc);

  // Cardinality is not currently in use.
  //each(doc.body.getElementsByTagName('*'), deriveCardinality);

  each(doc.body.getElementsByTagName('img'), deriveImageFeatures);
  eachNode(doc.body, NodeFilter.SHOW_TEXT, deriveTextFeatures);
  each(doc.body.getElementsByTagName('a'), deriveAnchorFeatures);
  each(doc.body.getElementsByTagName('*'), deriveAttributeTextFeatures);
  each(doc.body.getElementsByTagName('*'), deriveSiblingFeatures);
  each(doc.body.getElementsByTagName('*'), scoreElement);
  each(doc.body.getElementsByTagName('*'), applySiblingBias);

  if(options.FILTER_ATTRIBUTES) {
    each(doc.body.getElementsByTagName('*'), filterElementAttributes);  
  }

  doc.body.score = -Infinity;
  var bestElement = reduce(doc.body.getElementsByTagName('*'), 
    getHigherScoringElement, doc.body);

  if(options.UNWRAP_UNWRAPPABLES) {
    each(doc.body.querySelectorAll(SELECTOR_UNWRAPPABLE), function(element) {
      if(element != bestElement) {
        unwrapElement(element);
      }
    });
  }

  each(doc.body.getElementsByTagName('*'), function(element) {
    exposeAttributes(element, options);
  });

  if(options.HIGHLIGHT_MAX_ELEMENT) {
    if(bestElement == doc) {
      bestElement.body.style.border = '2px solid green';
    } else {
      bestElement.style.border = '2px solid green';  
    }
  }

  var results = doc.createDocumentFragment();
  if(bestElement == doc.body) {
    each(doc.body.childNodes, function(element) {
      results.appendChild(element);
    });
  } else {
    results.appendChild(bestElement);
  }
  return results;
}

/**
 * Cardinality represents a descendant count, but is sometimes dampened in
 * order to positively bias text density (e.g. nested tables).
 */
function deriveCardinality(element) {
  var cardinality = element.getElementsByTagName('*').length;

  if(cardinality) {

    element.cardinality = cardinality;

    // Greatly dampen cardinality of table rows
    var tableRowCardinality = element.getElementsByTagName('tr').length;
    if(tableRowCardinality) {

      element.cardinality -= tableRowCardinality;
      element.cardinality += 0.01 * tableRowCardinality;

      // Greatly dampen cardinality of table cells
      var tableCellCardinality = element.getElementsByTagName('td').length;
      if(tableCellCardinality) {
        element.cardinality -= tableCellCardinality;
        element.cardinality += 0.01 * tableCellCardinality;
      }
    }

    // Dampen cardinality of paragraphs so that we inflate text density
    var paragraphCardinality = element.getElementsByTagName('p').length;
    if(paragraphCardinality) {
      element.cardinality -= paragraphCardinality;
      element.cardinality += 0.2 * paragraphCardinality;
    }

  }
}

function deriveImageFeatures(image) {
  if(!image.hasAttribute('src')) return;
  var root = image.ownerDocument.body;
  var parentElement = image.parentElement;
  while(parentElement != root) {
    parentElement.imageCount = parentElement.imageCount || 0;
    parentElement.imageCount += 1;
    parentElement = parentElement.parentElement;
  }
}

function deriveTextFeatures(textNode) {

  var root = textNode.ownerDocument.body, parent = textNode.parentElement;
  parent.copyrightCount = /[©]|&copy;|&#169;/i.test(textNode.nodeValue) ? 1 : 0;
  parent.dotCount = countChar(textNode.nodeValue,'•');
  parent.pipeCount = countChar(textNode.nodeValue,'|');

  var charCount = textNode.nodeValue.length - 
    textNode.nodeValue.split(/[\s\.]/g).length + 1;

  while(parent != root) {
    parent.charCount = (parent.charCount || 0) + charCount;
    parent = parent.parentElement;
  }
}

function deriveAnchorFeatures(anchor) { 
  var root = anchor.ownerDocument.body, parent = anchor.parentElement;
  if(anchor.charCount && anchor.hasAttribute('href')) {
    anchor.anchorCharCount = anchor.charCount;
    while(parent != root) {
      parent.anchorCharCount = (parent.anchorCharCount || 0 ) + anchor.charCount;
      parent = parent.parentElement;
    }
  }
}

function deriveAttributeTextFeatures(element) {
  element.attributeText = ((element.getAttribute('id') || '') + ' ' + 
    (element.getAttribute('class') || '')).trim().toLowerCase();
  if(!element.attributeText) {
    delete element.attributeText;
  }
}

/**
 * Apply our 'model' to an element. This is similar to a simple 
 * regression model. We generate a 'score' that is the sum of several
 * terms from the right hand side of a basic formula.
 */
function scoreElement(element) {

  element.score = element.score || 0;

  if(element.charCount && !element.matches(SELECTOR_LEAFY)) {
    element.anchorDensity = element.anchorCharCount / element.charCount;

    if(element.charCount > 1000) {
      if(element.anchorDensity > 0.35) {
        element.branch = 1;
        element.score += 50;
      } else if(element.anchorDensity > 0.2) {
        element.branch = 9;
        element.score += 100;
      } else if (element.anchorDensity > 0.1) {
        element.branch = 11;
        element.score += 100;
      } else if(element.anchorDensity > 0.05) {
        element.branch = 12;
        element.score += 200;
      } else {
        element.branch = 2;
        element.score += 300;
      }
    } else if(element.charCount > 500) {
      if(element.anchorDensity > 0.35) {
        element.branch = 3;
        element.score += 30;
      } else if(element.anchorDensity > 0.1) {
        element.branch = 10;
        element.score += 180;
      } else {
        element.branch = 4;
        element.score += 220;
      }
    } else if(element.charCount > 100) {
      if(element.anchorDensity > 0.35) {
        element.branch = 5;
        element.score += -100;
      } else {
        element.branch = 6;
        element.score += 100;
      }
    } else {
      if(element.anchorDensity > 0.35) {
        element.branch = 7;
        element.score -= 200;
      } else if(isFinite(element.anchorDensity)) {
        element.branch = 8;
        element.score += 20;
      } else {
        element.branch = 8;
        element.score += 5;
      }
    }
  }

  element.score += element.siblingCount ? 
    (2 - 2 * element.previousSiblingCount / element.siblingCount) : 0;
  element.score += element.siblingCount ? 
    (2 - 2 * (Math.abs(element.previousSiblingCount - (element.siblingCount / 2) ) / 
      (element.siblingCount / 2) ) ) : 0;

  element.score += TAG_NAME_BIAS[element.localName] || 0;
  
  // TODO: propagate partial to children?

  if(element.attributeText) {
    element.score += ID_CLASS_KEYS.reduce(function(sum, key, index) {
      return element.attributeText.indexOf(key) > -1 ?
        sum + ID_CLASS_VALUES[index] : sum;
    }, 0);
  }

  element.score += -20 * (element.copyrightCount || 0);
  element.score += -20 * (element.dotCount || 0);
  element.score += -10 * (element.pipeCount || 0);


  // Bias all of the descendants of certain ancestor elements
  var ancestorBias = ANCESTOR_BIAS[element.localName];
  if(isFinite(ancestorBias)) {
    each(element.getElementsByTagName('*'), function(childElement) {
      childElement.score = childElement.score || 0;
      childElement.score += ancestorBias;
    });
  }

  // Bias the immediate ancestor of certain elements
  var descendantBias = DESCENDANT_BIAS[element.localName];
  if(descendantBias && element.parentElement != element.ownerDocument.body) {
    element.parentElement.score = element.parentElement.score || 0;
    element.parentElement.score += descendantBias;
  }
}

function deriveSiblingFeatures(element) {
  element.siblingCount = element.parentElement.childElementCount - 1;
  element.previousSiblingCount = 0;
  if(element.siblingCount) {
    var sibling = element.previousElementSibling;
    while(sibling) {
      element.previousSiblingCount++;
      sibling = sibling.previousElementSibling;
    }
  }
}

/**
 * Propagate scores to nearby siblings. Look up to 2 elements 
 * away in either direction. The idea is that content generally
 * follows content, and boilerplate generally follows boilerplate.
 * Contiguous blocks should get promoted by virture of their 
 * context.
 */
function applySiblingBias(element) {
  var elementBias = element.score > 0 ? 5 : -5;
  var sibling = element.previousElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    //if(Math.abs(sibling.score - element.score) < 20) {
      sibling.score += elementBias;
    //}
    sibling = sibling.previousElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      //if(Math.abs(sibling.score - element.score) < 20) {
        sibling.score += elementBias;
      //}
    }
  }

  sibling = element.nextElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    //if(Math.abs(sibling.score - element.score) < 20) {
      sibling.score += elementBias;
    //}
    sibling = sibling.nextElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      //if(Math.abs(sibling.score - element.score) < 20) {
        sibling.score += elementBias;
      //}
    }
  }
}

/**
 * Compares two elements and returns the element with the higher score.
 * The prior element is assumed to come first in document order. 
 * If the two have equal scores the prior element is returned.
 */
function getHigherScoringElement(previous, current) {
  return current.score > previous.score ? current : previous;
}

function exposeAttributes(element, options) {

  if(options.SHOW_BRANCH && element.branch) {
    element.setAttribute('branch', element.branch);
  }

  if(options.SHOW_CARDINALITY && element.cardinality) {
    element.setAttribute('cardinality', element.cardinality.toFixed(2));  
  }

  if(options.SHOW_ANCHOR_DENSITY && element.anchorDensity) {
    element.setAttribute('anchorDensity', element.anchorDensity.toFixed(2));
  }

  if(options.SHOW_CHAR_COUNT && element.charCount) {
    element.setAttribute('charCount', element.charCount);  
  }

  if(options.SHOW_COPYRIGHT_COUNT && element.copyrightCount) {
    element.setAttribute('copyrightCount', element.copyrightCount);
  }

  if(options.SHOW_DOT_COUNT && element.dotCount) {
    element.setAttribute('dotCount', element.dotCount);
  }

  if(options.SHOW_PIPE_COUNT && element.pipeCount) {
    element.setAttribute('pipeCount', element.pipeCount);
  }

  if(options.SHOW_SCORE && element.score) {
    element.setAttribute('score', element.score.toFixed(2));
  }
}

function filterInvisibleElement(element) {
  if(!element) {
    return;
  }

  if(element.style.display == 'none') {
    //console.log('removing display:none element %s', element.outerHTML);
    element.parentElement.removeChild(element);
  } else if(element.style.visibility == 'hidden') {
    //console.log('removing visibility:hidden element %s', element.outerHTML);
    element.parentElement.removeChild(element);
  } else if(isFinite(element.style.opacity) && parseInt(element.style.opacity) === '0') {
    //console.log('removing opacity:0 element %s', element.outerHTML);
    element.parentElement.removeChild(element);
  } else {
    var width = element.width || element.getAttribute('width') || element.style.width || 
      element.style.minWidth || element.style.maxWidth;
    var height = element.height || element.getAttribute('heigh') || element.style.height || 
      element.style.minHeight || element.style.maxHeight;
    if(parseInt(height) === 0 || parseInt(width) === 0) {
      //console.log('removing element with 0 height or 0 width %s', element.outerHTML);
      element.parentElement.removeChild(element);
    }
  }
}

function filter1DImage(element) {
  if(!element) {
    console.warn('filter1DImage: undefined element');
    return;
  }
  var width = element.width || element.getAttribute('width') || element.style.width || 
    element.style.minWidth || element.style.maxWidth;
  var height = element.height || element.getAttribute('heigh') || element.style.height || 
    element.style.minHeight || element.style.maxHeight;
  width = width ? parseInt(width, 10) : 0;
  height = height ? parseInt(height, 10) : 0;

  // Remove 1x1 or 1xY or Yx1
  if(width == 1 || height == 1) {
    element.parentElement.removeChild(element);
  }
}

/** Removes attributes that should not appear in the output from the element. */
function filterElementAttributes(element) {
  // NOTE: if attribute.parentNode is a thing we shold be using that
  // we could just use removeNode

  var removeAttributeNode = function(attribute) {
    // console.log(attribute.parentNode == element);

    element.removeAttributeNode(attribute);
  };

  // Filtering into a new array avoids the issue of removing 
  // things from a live collection while iterating.
  Array.prototype.filter.call(element.attributes, isRemovableAttribute).forEach(
    removeAttributeNode);
}

function isRemovableAttribute(attribute) {
  return attribute.name != 'href' && attribute.name != 'src';
}

/**
 * Replaces each occurrence of <br/> or <hr/> with <p></p>.
 * NOTE: per VIPs, HR should move remaining children to sibling
 * div of parent, whereas BR just replaced with P, which is 
 * more like node.splitText
 */
function transformRuleElement(element) { 
  var p = element.ownerDocument.createElement('p');
  p.setAttribute('id', element.parentNode.getAttribute('id'));
  p.setAttribute('class', element.parentNode.getAttribute('class'));
  element.parentNode.replaceChild(p, element);
}

function cascadeWhitespaceImportant(element) {
  setWhitespaceImportant(element);
  each(element.getElementsByTagName('*'), setWhitespaceImportant);
}

function setWhitespaceImportant(element) {
  element.whitespaceImportant = true;
}

function trimAndMaybeRemoveTextNode(node) {
  if(node.parentElement.whitespaceImportant) {
    // We are in a PRE/CODE axis, so noop
    return;
  }

  if(isInlineElement(node.previousSibling)) {
    if(!isInlineElement(node.nextSibling)) {
      node.nodeValue = node.nodeValue.trimRight();
    }
  } else if(isInlineElement(node.nextSibling)) {
    node.nodeValue = node.nodeValue.trimLeft();
  } else {
    node.nodeValue = node.nodeValue.trim();
  }

  if(!node.nodeValue) {
    removeNode(node);
  }
}

/** get parent of element with side effect of removing the element */
function removeElementAndReturnParent(element) {
  var parentElement = element.parentElement;
  parentElement.removeChild(element);
  return parentElement;
}

function isEmptyLikeElement(element) {
  return !element.firstChild && !element.matches(SELECTOR_LEAFY);
}

function pruneEmptyElements(doc) {
  var root = doc.body, parent, grandParent, safeguard = 0,
  stack = Array.prototype.filter.call(
    doc.body.getElementsByTagName('*'), isEmptyLikeElement).map(
      removeElementAndReturnParent);

  while(stack.length && safeguard++ < 10000) {
    parent = stack.pop();
    if(!parent.firstChild) {
      grandParent = parent.parentElement;
      if(grandParent) {
        grandParent.removeChild(parent);
        if(grandParent != root)
          stack.push(grandParent);        
      }
    }
  }
}

function isInlineElement(node) {
  return node && node.nodeType == Node.ELEMENT_NODE && node.matches(SELECTOR_INLINE);
}

function countChar(str, ch) {
  // http://jsperf.com/count-the-number-of-characters-in-a-string
  // return str.split('|').length - 1;

  for(var count = -1, index = 0; index != -1; count++) {
    index = str.indexOf(ch, index+1);    
  }

  return count;
}

function reduce(obj, func, start) {
  // Would maybe make more sense to just use a closure 
  // variable like var reduce = Array.prototype.reduce and 
  // then just use reduce.call()
  return Array.prototype.reduce.call(obj,func,start);
}

function each(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0; i < len; 
    func(obj[i++])) {
  }
}

/**
 * Simple helper to use foreach against traversal API
 */
function eachNode(element, type, func, filter) {
  var node, iterator = element.ownerDocument.createNodeIterator(element, type, filter);
  while(node = iterator.nextNode()) { func(node); }
}

/**
 * Removes the element but retains its children. Useful for 
 * removing 'wrapper' style elements like span/div/form
 */
function unwrapElement(element) {
  if(element) {
    while(element.firstChild)
      element.parentNode.insertBefore(element.firstChild, element);
    element.parentNode.removeChild(element);    
  }
}

/**
 * For passing to forEach and such. Also works for nodes.
 * May also work for attribute nodes?
 */
function removeNode(node) {
  if(node && node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

}(this)); 