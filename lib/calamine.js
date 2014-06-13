/**
 * Copyright 2014 Josh Froelich. MIT licensed.
 *
 * A simple module for removing boilerplate from web pages.
 */
var calamine = (function(exports, each) {
'use strict';

// NOTE: this is incomplete, see sanitizer for the proper list.
var BAD_TAG = ['applet','button','embed','frame','frameset','head',
'iframe','input','object','option','script','select','style'];
var BAD_TAG_SELECTOR = BAD_TAG.join(',');

/** Bias lookup table for getTagNameBias */
var TAG_NAME_BIAS = {
  a:-1, address:-3, article:30, blockquote:3, button:-100, dd:-3,
  div:5, dl:-10, dt:-3, footer:-20, font:0, form: -3, header: -5,
  h1: -2, h2: -2, h3: -2, h4: -2, h5: -2, h6: -2, li: -10, nav: -50,
  ol:-20, p:10, pre:3, section:10, td:3, time:0, tr:1, th:-3, ul:-20
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

// TODO: these should be default options, and transformDocument
// should have an options parameter.
var options = {
  HIGHLIGHT_MAX_ELEMENT: 1,
  SHOW_CARDINALITY: 0,
  SHOW_CHAR_COUNT: 0,
  SHOW_SCORE: 1,
  SHOW_TEXT_DENSITY: 0,
  UNWRAP_NOSCRIPT: 1
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
function transformDocument(doc) {

  each(doc.body.querySelectorAll(BAD_TAG_SELECTOR), removeNode);
  eachNode(doc.body, NodeFilter.SHOW_COMMENT, removeNode);
  if(options.UNWRAP_NOSCRIPT)
    each(doc.body.querySelectorAll('noscript'), unwrapElement);
  each(doc.body.querySelectorAll('hr,br'), transformRuleElement);
  Array.prototype.filter.call(doc.body.getElementsByTagName('*'), 
    isEmptyElement).forEach(removeNode);
  each(doc.body.getElementsByTagName('*'), deriveCardinality);
  each(doc.body.getElementsByTagName('img'), deriveImageFeatures);
  eachNode(doc.body, NodeFilter.SHOW_TEXT, deriveTextFeatures);
  each(doc.body.getElementsByTagName('a'), deriveAnchorFeatures);
  each(doc.body.getElementsByTagName('*'), scoreElement);
  each(doc.body.getElementsByTagName('*'), applySiblingBias);

  // Disabled while debugging.
  //each(doc.body.getElementsByTagName('*'), filterElementAttributes);

  doc.body.score = -Infinity;
  var bestElement = Array.prototype.reduce.call(
    doc.body.getElementsByTagName('*'), getHigherScoringElement, doc.body);

  // TODO: include proximate content, exclude certain nested boilerplate
  // options.HIGHLIGHT_MAX needs refactoring to allow for multiple elements?

  if(options.HIGHLIGHT_MAX_ELEMENT) {
    if(bestElement == doc) {
      bestElement.body.style.border = '2px solid green';
    } else {
      bestElement.style.border = '2px solid green';  
    }
  }

  if(options.SHOW_SCORE) {
    each(doc.body.getElementsByTagName('*'), setScoreAttribute);
  }

  if(options.SHOW_CHAR_COUNT) {
    each(doc.body.getElementsByTagName('*'), setCharCountAttribute);
  }

  // TODO: is this really necessary?
  each(doc.body.getElementsByTagName('*'), cleanNonNativeProperties);

  // Commented while debugging
  // each(doc.body.querySelectorAll('div,form,span'), unwrapElement);

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
 */
function deriveCardinality(element) {
  var cardinality = element.getElementsByTagName('*').length;
  var originalCardinality = cardinality;

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

    if(options.SHOW_CARDINALITY) {
      element.setAttribute('cardinality', element.cardinality || 0);
      element.setAttribute('originalCardinality', originalCardinality || 0);
    }
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
 * Extracts text features
 * 
 * Rather than calling textContent on every element, we use an 
 * agglomerative bottom-up approach that accumulates charCount
 * in the hierarchy. I am assuming this is more performant.
 *
 * TODO: experiment with subtracting value.split(/[\s\.]/g).length
 * For better performance, combine the calculation with the trim op.
 */
function deriveTextFeatures(textNode) {

  var rootElement = textNode.ownerDocument.body,
    value = textNode.nodeValue.trim(), 
    charCount = 0, parentElement;

  if(!value) return;

  charCount = value.length;

  parentElement = textNode.parentElement;
  while(parentElement != rootElement) {
    parentElement.charCount = parentElement.charCount ?
      parentElement.charCount + charCount : charCount;
    parentElement = parentElement.parentElement;
  }

  // Look for copyright characters
  // TODO: look for other non-token characters like pipes
  if(/[©]|&copy;|&#169;/i.test(value)) {
    parentElement.copyrightCount = 1;
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

/**
 * Apply our 'model' to an element. This is similar to a simple 
 * regression model. We generate a 'score' that is the sum of several
 * terms from the right hand side of a basic formula.
 */
function scoreElement(element) {
  // Ensure our left hand side is defined
  element.score = element.score || 0;

  // Anchor density
  // See "Boilerplate Detection using Shallow Text Features"
  var anchorDensity = element.anchorCharCount / element.charCount;
  element.score += element.anchorCharCount && element.charCount ? 
    (anchorDensity > 0.34 ? -100 : 100) : 0;

  // Text density
  var textDensity = 0;
  if(element.localName != 'img' && element.charCount) {
    if(element.cardinality && element.cardinality > 3) {
      // Normal desirable cardinality influence/behavior
      textDensity = (element.charCount || 0) / element.cardinality;

      if(textDensity > 20) {
        // Very high chance of content
        element.score += 200;
      } else if(textDensity > 10.5) {
        // High chance of content
        element.score += 100;
      } else if(textDensity > 7) {
        // Questionable
        element.score += 20;
      } else {
        // Boilerplate
        element.score -= 100;
      }
    } else if(element.cardinality && element.cardinality > 1) {
      // Less normal cardinality behavior
      textDensity = element.charCount / 10;
      // Questionable chance of content
      element.score += 20;
    } else {
      // Paranormal cardinality behavior. Cardinality may be 
      // undefined or 0.

      // This issue dealt with by this branch similar to the issue
      // surrounding 'text less than a single line in length' that 
      // is discussed in the paper
      textDensity = element.charCount / 10;

      // Very small chance of content
      element.score += 10;
    }

    // TODO: this should moved somewhere else
    if(options.SHOW_TEXT_DENSITY) {
      element.setAttribute('textDensity', textDensity);
    }
  }

  // Positional bias
  // TODO: sib count and prevsibcount are features that should already be 
  // extracted, not calculated here when scoring.
  var siblingCount = element.parentElement.childElementCount - 1, 
    previousSiblingCount = 0, sibling, halfSiblingCount = siblingCount / 2;
  if(siblingCount) {
    sibling = element.previousElementSibling;
    while(sibling) {
      previousSiblingCount++;
      sibling = sibling.previousElementSibling;
    }

    // From start
    element.score += 2 - 2 * previousSiblingCount / siblingCount;
    // From mid
    element.score += 2 - 2 * (Math.abs(previousSiblingCount - halfSiblingCount) / halfSiblingCount);
  }

  // Tag name bias  
  var tagNameBias = TAG_NAME_BIAS[element.localName];
  element.score += tagNameBias ? tagNameBias : 0;

  // Attribute id/class token bias
  var attributeText = ((element.getAttribute('id') || '') + ' ' + 
    (element.getAttribute('class') || '')).trim();
  element.score += attributeText ? (RE_POSITIVE_CLASS.test(attributeText) ?  
    25 : (RE_NEGATIVE_CLASS.test(attributeText) ? -25 : 0  ))  : 0;

  // NOTE: Reward diversity of children (see VIPs)?
  //var descendantDiversity = 0; element.score += descendantDiversity;

  /**
   * Brainstorming: css opacity, css visibility, 
   * css display, background color == foreground color, background color 
   * contrast to bgcolor of all parents in path to root, weak difference 
   * between background and foreground, width/height attribute, relative 
   * font size, dimensions (bounds rect), degree of perceived overlap 
   * with all other elements, whether completely overlapped, element 
   * background image, page background image, background image color 
   * histogram (grossssss), inter-element distance (margins/padding), 
   * onload page visibility (whether text shows up before scroll),
   * offsets (general location)
   */
  //var styleBias = 0; element.score += styleBias;


  // Copyright bias
  // TODO: pipe bias
  element.score += element.copyrightCount ? -20 : 0;
  
  // NOTE: propagate here because I assume it is faster than having to do 
  // several intersection tests.
  // Bias all of the descendants of certain ancestor elements
  var ancestorBias = ANCESTOR_BIAS[element.localName];
  if(isFinite(ancestorBias)) {
    each(element.getElementsByTagName('*'), function(childElement) {
      childElement.score = childElement.score || 0;
      childElement.score += ancestorBias;
    });
  }

  // This is basically an 'over path' term, but is limited to 
  // direct ancestors. It is limited to one edge traversal because it 
  // it can super-inflate connected vertices, which is not 
  // desirable. Bias the immediate ancestor of certain descendant elements
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
  return current.score >= previous.score ? current : previous;
}

function cleanNonNativeProperties(element) {
  delete element.anchorCharCount;
  delete element.cardinality;
  delete element.charCount;
  delete element.copyrightCount;
  delete element.imageCount;
  delete element.score;
}

function setCharCountAttribute(element) {
  element.setAttribute('charCount', element.charCount);
}

function setScoreAttribute(element) {
  element.setAttribute('score', element.score.toFixed(2));
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

/**
 * Returns true if an element is 'empty' in the sense that 
 * it should be ignored or pruned/removed from the document.
 */
function isEmptyElement(element) {
  
  // Carve out an exception for images.
  // TODO: and iframes/video/audio/object/applet etc.
  if(element.localName == 'img') {
    return 0;
  }

  var childNodeCount = element.childNodes.length;
  if(childNodeCount == 1 && element.firstChild.nodeType == Node.TEXT_NODE) {
    return  !element.firstChild.nodeValue.trim().length;
  } 

  return !childNodeCount;
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

/** public */
return {
  transform: transformDocument,
  options: options
};

}(this, util.each)); 