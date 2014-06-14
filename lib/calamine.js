/**
 * Copyright 2014 Josh Froelich. MIT licensed.
 *
 * A simple module for removing boilerplate from web pages.
 */
var calamine = (function(exports) {
'use strict';

// NOTE: this is incomplete, see sanitizer for the proper list.
var BAD_TAG = ['applet','button','embed','frame','frameset','head',
'iframe','input','object','option','script','select','style','link'];
var BAD_TAG_SELECTOR = BAD_TAG.join(',');

// TODO: should consider that some of these are filtered
// and not bother to test here
var NON_TEXT_CONTAINER = {
  applet:1,audio:1,img:1,iframe:1,object:1,param:1,video:1,canvas:1
};

// NOTE: is this identical to NON_TEXT_CONTAINER?
var LEAF_LIKE_ELEMENT = {
  applet:1,audio:1,br:1,canvas:1,hr:1,img:1,iframe:1,object:1,embed:1,frame:1,video:1
};

/** Bias lookup table for getTagNameBias */
var TAG_NAME_BIAS = {
  a:-1, address:-3, article:30, blockquote:3, button:-100, dd:-3,
  div:20, dl:-10, dt:-3, footer:-20, font:0, form: -3, header: -5,
  h1: -2, h2: -2, h3: -2, h4: -2, h5: -2, h6: -2, li: -20, nav: -50,
  ol:-20, p:10, pre:3, section:10, small:-1,td:3, time:0, tr:1, th:-3, ul:-20
};

/** Promote if id/class attribute contains */
var POSITIVE_CLASS_TOKEN = [
 'article','author','body','byline','attachment','content','carousel',
 'comic','entry','main','post','text','blog','story'];

/** Penalize if id/class attribute contains */
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

/** Immediate parent elements are biased for containing these elements. */
var DESCENDANT_BIAS = {
  p:5, h1:1, h2:1, h3:1, h4:1, h5:1, h6:1, blockquote:3,
  sub:2, sup:2, pre:2, code:2, time:2, span:1, i:1, em:1,
  strong:1, b:1
};

/** These ancestor elements bias all descendants. */
var ANCESTOR_BIAS = {
  nav:-20, div:1, header:-5, table:-2, ol:-5, ul:-5, li:-3,
  dl:-5, p:10, blockquote:10, pre:10, code:10
};

var INLINE_ELEMENT = {
  a:1,abbr:1,acronym:1,b:1,bdo:1,big:1,cite:1,code:1,dfn:1,
  em:1,kbd:1,i:1,q:1,samp:1,small:1,span:1,strong:1,sub:1,
  sup:1,tt:1,'var':1
};

var UNWRAPPABLE = {
  center:1,div:1,font:1,form:1,span:1
};

var DEFAULT_OPTIONS = {
  FILTER_ATTRIBUTES: 1,
  HIGHLIGHT_MAX_ELEMENT: 0,
  SHOW_ANCHOR_DENSITY: 0,
  SHOW_BRANCH: 0,
  SHOW_CARDINALITY: 0,
  SHOW_CHAR_COUNT: 0,
  SHOW_SCORE: 0,
  UNWRAP_UNWRAPPABLES: 0
};


/** public API
- hoisting is sweet
*/
return {
  transform: transformDocument,
};


/**
 * Apply calamine to an HTMLDocument object. Returns the best
 * element to use as the source of the new document.
 * 
 * The current implementation focuses on accuracy and clear code
 * over performance. Preliminary testing shows reasonable performance 
 * even with massively redundant iteration.
 *
 * TODO: re-introduce support for iframes.
 * TODO: return a docfrag. rename this to createDocumentFragment or 
 * something
 */
function transformDocument(doc, options) {

  options = options || DEFAULT_OPTIONS;

  each(doc.body.querySelectorAll(BAD_TAG_SELECTOR), removeNode);
  eachNode(doc.body, NodeFilter.SHOW_COMMENT, removeNode);
  each(doc.body.querySelectorAll('img'), filterDotImages);
  each(doc.body.querySelectorAll('noscript'), unwrapElement);
  each(doc.body.querySelectorAll('hr,br'), transformRuleElement);
  each(doc.body.getElementsByTagName('pre'), cascadeWhitespaceImportant);
  each(doc.body.getElementsByTagName('code'), cascadeWhitespaceImportant);
  eachNode(doc.body, NodeFilter.SHOW_TEXT, trimAndMaybeRemoveTextNode);
  pruneEmptyElements(doc);
  each(doc.body.getElementsByTagName('*'), deriveCardinality);
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

  // TODO: include proximate content, exclude certain nested boilerplate
  // options.HIGHLIGHT_MAX needs refactoring to allow for multiple elements

  if(options.UNWRAP_UNWRAPPABLES) {
    each(doc.body.querySelectorAll('*'), function(element) {
      if(element && element != bestElement && (UNWRAPPABLE[element.localName] || 
        (element.localName == 'a' && !element.hasAttribute('href')))) {
        unwrapElement(element);
      }
    });    
  }

  if(options.HIGHLIGHT_MAX_ELEMENT) {
    if(bestElement == doc) {
      bestElement.body.style.border = '2px solid green';
    } else {
      bestElement.style.border = '2px solid green';  
    }
  }

  each(doc.body.getElementsByTagName('*'), function(element) {
    exposeAttributes(element, options);
  });

  each(doc.body.getElementsByTagName('*'), cleanNonNativeProperties);

  // TODO: create a docfrag, then remove elements in succession and 
  // append them to the doc frag, then return the docfrag.
  // remove in succession from input to avoid need to do intersection tests
  // Note: the caller has to use adoptNode on the doc frag
  // Note: if bestElement is body place the children of body in the frag
  return bestElement;
}

/**
 * Cardinality represents a descendant count, but is sometimes dampened in
 * order to positively bias text density (e.g. nested tables).
 * TODO: this might be deprecated once new scoring technique settles
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

    // TODO: dampen other 'content' containers like b,i,embed,strong,span
  }
}

/**
 * Propagate image metrics
 * TODO: use diff weights for image dimensions? the larger the 
 * area, the larger the score, because the image takes up 
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
 * NOTE: clamp area to 800x600.
 * NOTE: penalize 1x1 (matches signature of hidden image tracking)
 * Also: another obvious image weighting technique is alt/title text.
 */
function deriveImageFeatures(image) {
  if(!image.hasAttribute('src')) return;
  var root = image.ownerDocument.body;
  var parentElement = image.parentElement;
  while(parentElement != root) {
    parentElement.imageCount = parentElement.imageCount ?
      parentElement.imageCount + 1 : 1;
    parentElement = parentElement.parentElement;
  }
}

/**
 * TODO: experiment with subtracting value.split(/[\s\.]/g).length
 * TODO: look for other non-token characters like pipes
 */
function deriveTextFeatures(textNode) {

  var root = textNode.ownerDocument.body, parent = textNode.parentElement;

  if(/[©]|&copy;|&#169;/i.test(textNode.nodeValue)) {
    parent.copyrightCount = 1;
  }

  // Propagate charCount up
  while(parent != root) {
    parent.charCount = parent.charCount || 0;
    parent.charCount += textNode.nodeValue.length;
    parent = parent.parentElement;
  }
}

function deriveAnchorFeatures(anchor) { 
  var root = anchor.ownerDocument.body, parent = anchor.parentElement;
  if(anchor.charCount && anchor.hasAttribute('href')) {
    anchor.anchorCharCount = anchor.charCount;
    while(parent != root) {
      parent.anchorCharCount = parent.anchorCharCount || 0;
      parent.anchorCharCount += anchor.charCount;
      parent = parent.parentElement;
    }
  }
}

function deriveAttributeTextFeatures(element) {
  element.attributeText = ((element.getAttribute('id') || '') + ' ' + 
    (element.getAttribute('class') || '')).trim();
}

/**
 * Apply our 'model' to an element. This is similar to a simple 
 * regression model. We generate a 'score' that is the sum of several
 * terms from the right hand side of a basic formula.
 */
function scoreElement(element) {

  element.score = element.score || 0;

  if(element.charCount && !(element.localName in NON_TEXT_CONTAINER)) {
    element.anchorDensity = element.anchorCharCount / element.charCount;

    // TODO: this needs massive testing
    if(element.charCount > 1000) {
      if(element.anchorDensity > 0.35) {
        element.branch = 1;
        element.score += 10;//intentionally positive
      } else {
        element.branch = 2;
        element.score += 300;
      }
    } else if(element.charCount > 500) {
      if(element.anchorDensity > 0.35) {
        element.branch = 3;
        element.score += -10;
      } else {
        element.branch = 4;
        element.score += 200;
      }
    } else if(element.charCount > 100) {
      if(element.anchorDensity > 0.35) {
        element.branch = 5;
        element.score += -100;
      } else {
        element.branch = 6;
        element.score += 50;
      }
    } else {
      if(element.anchorDensity > 0.35) {
        element.branch = 7;
        element.score -= 200;
      } else {
        element.branch = 8;
        element.score += 20;
      }
    }
  }

  element.score += element.siblingCount ? 
    (2 - 2 * element.previousSiblingCount / element.siblingCount) : 0;
  element.score += element.siblingCount ? 
    (2 - 2 * (Math.abs(element.previousSiblingCount - (element.siblingCount / 2) ) / 
      (element.siblingCount / 2) ) ) : 0;

  element.score += TAG_NAME_BIAS[element.localName] || 0;
  element.score += element.attributeText ? (RE_POSITIVE_CLASS.test(element.attributeText) ?  
    25 : (RE_NEGATIVE_CLASS.test(element.attributeText) ? -25 : 0  ))  : 0;

  element.score += element.copyrightCount ? -20 : 0;
  // TODO: pipe bias

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

function cleanNonNativeProperties(element) {
  delete element.anchorCharCount;
  delete element.anchorDensity;
  delete element.attributeText;
  delete element.branch;
  delete element.cardinality;
  delete element.charCount;
  delete element.copyrightCount;
  delete element.imageCount;
  delete element.previousSiblingCount;
  delete element.score;
  delete element.siblingCount;
  delete element.whitespaceImportant;
}

function exposeAttributes(element, options) {

  if(options.SHOW_BRANCH && element.branch) {
    element.setAttribute('branch', element.branch);
  }

  if(options.SHOW_CARDINALITY && isFinite(element.cardinality)) {
    element.setAttribute('cardinality', element.cardinality.toFixed(2));  
  }

  if(options.SHOW_ANCHOR_DENSITY && isFinite(element.anchorDensity)) {
    element.setAttribute('anchorDensity', element.anchorDensity.toFixed(2));
  }

  if(options.SHOW_CHAR_COUNT && isFinite(element.charCount)) {
    element.setAttribute('charCount', element.charCount);  
  }

  if(options.SHOW_SCORE && isFinite(element.score)) {
    element.setAttribute('score', element.score.toFixed(2));
  }
}


function filterDotImages(element) {
  if(!element) {
    console.warn('filterDotImages: undefined element');
    return;
  }
  var width = element.width || element.getAttribute('width') || element.style.width || 
    element.style.minWidth || element.style.maxWidth;
  var height = element.height || element.getAttribute('heigh') || element.style.height || 
    element.style.minHeight || element.style.maxHeight;
  width = width ? parseInt(width) : 0;
  height = height ? parseInt(height) : 0;

  // Remove 1x1 or 1xY or Yx1
  if(width == 1 || height == 1) {
    element.parentElement.removeChild(element);
  }
}

/**
 * Removes attributes that should not appear in the output from 
 * the element.
 */
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
 * div of parent, whereas BR just replaced with P.
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
  if(node.parentElement.whitespaceImportant) return;

  var ps = node.previousSibling ? node.previousSibling.localName : '';
  var ns = node.nextSibling ? node.nextSibling.localName : '';

  if(INLINE_ELEMENT[ps]) {
    if(!INLINE_ELEMENT[ns]) {
      node.nodeValue = node.nodeValue.trimRight();
    }
  } else if(INLINE_ELEMENT[ns]) {
    node.nodeValue = node.nodeValue.trimLeft();
  } else {
    node.nodeValue = node.nodeValue.trim();
  }

  if(!node.nodeValue) {
    removeNode(node);
  }
}

function pruneEmptyElements(doc) {

  var root = doc.body, p, p2, safeguard = 0,
  pq = Array.prototype.filter.call(doc.body.getElementsByTagName('*'), function(element) {
    // Return true if this is a leaf-like node we want to remove
    return !element.firstChild && !(element.localName in LEAF_LIKE_ELEMENT);
  }).map(function(element) {
    // Remove (side effect) the leaf element and enqueue its parent
    var p = element.parentElement;
    p.removeChild(element);
    return p;
  });

  // Removing an element can cause its parent to become
  // removable, so remove those as well.

  // Before looping, we filled a queue with the parents
  // of the leaves we already removed. Now process those parents.

  // While the queue is not empty
  while(pq.length) {
    // Remove the last element in the queue
    p = pq.pop();
    // Check if it is leaf
    if(!p.firstChild) {
      // If it is a leaf, cache a reference to its parent
      p2 = p.parentElement;

      // If the parent still exists (it could already have 
      // been removed because there can be dups in the queue and 
      // this might not be the first instance of the parent)
      if(p2) {
        // Remove it
        p2.removeChild(p);

        // if the parent is not the doc root, queue it
        if(p2 != root)
          pq.push(p2);        
      }
    }

    if(safeguard++ > 10000) {
      console.warn('Reached safeguard when removing empty elements. The document may be too large.');
      break;
    }
  }
}

function reduce(obj, func, start) {
  return Array.prototype.reduce.call(obj,func,start);
}

function each(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0; i < len; 
    func(obj[i++])) {
  }
}

/**
 * Simple helper to bring node iteration API inline with nodelist iteration
 * Filter is optional.
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
  while(element.firstChild)
    element.parentNode.insertBefore(element.firstChild, element);
  element.parentNode.removeChild(element);  
}

/**
 * For passing to forEach and such. Also works for nodes.
 * May also work for attribute nodes?
 */
function removeNode(element) {
  if(element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

}(this)); 