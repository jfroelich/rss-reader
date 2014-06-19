/**
 * Copyright 2014 Josh Froelich. MIT licensed.
 *
 * A simple module for removing boilerplate from web pages.
 *
 * TODO: support for iframes and embed objects and audio/video
 * TODO: refactor to use block generation. Group lis together. Group
 * dds together, etc.
 * TODO: refactor to use block weighting. The return signature is simply
 * those blocks above a minimum threshold, which could be based on a 
 * percentage of blocks to return value. But this time use the element
 * weighting technique. Consider treating divs as inline and using 
 * only certain block parents (e.g. look for ul/ol/p/img/iframe as the only 
 * allowable block segments).
 * TODO: do not necessarily exclude textnodes that are immediate children of body.
 * All top level text should probably be converted to paragraphs before scoring.
 * TODO: include other proximate or high scoring elements outside of the 
 * best element, then rescan and filter out any extreme boilerplate 
 * such as certain lists or ads. When building the frag, consider removing
 * each element from the original body such that each successive search for 
 * another element does not have perform intersection tests.
 * TODO: the more I think about the above, the more I think I should go 
 * back to blocks (which would simplify BR split), but this time add in 
 * hierarchical weighting. The crux of the problem then becomes how
 * pick the blocks to return. I would have to incorporate some better
 * all blocks in this element type of biasing that promotes blocks like
 * they do now, but also get rid of upward propagation.
 * NOTE: this wouldn't simplify the BR transform, that is still screwed up
 * NOTE: The fundamental problem is that I am not obtaining "all" of the desired
 * elements from the age because sometimes they are not all in the same block.
 * And when I do get the parent element right, sometimes I still end up 
 * getting alot of nested boilerplate. At that point I would need to filter
 * the boilerplate, at which point I am nearly back to block score.
 * TODO: performance testing, memory testing
 */
var calamine = (function() {
'use strict';

var filter = Array.prototype.filter,
reduce = Array.prototype.reduce,

/** Remove these elements, including children */
SELECTOR_REMOVABLE = 'applet,base,basefont,button,command,datalist,'+
'dialog,embed,fieldset,frame,frameset,head,iframe,img:not([src]),input,'+
'link,math,meta,noframes,object,option,optgroup,output,param,script,'+
'select,style,title,textarea',

/** Remove these elements, excluding children, if OPTIONS.UNWRAP_UNWRAPPABLE is set */
SELECTOR_UNWRAPPABLE = 'a:not([href]),big,blink,body,center,div,font,form,'+
'html,legend,small,span,tbody,thead',

/** Elements that should not be considered empty/textual */
SELECTOR_LEAFY = 'applet,audio,br,canvas,embed,frame,hr,iframe,img,object,video',

/** Elements that exhibit display:inline behavior by default */
SELECTOR_INLINE = 'a,abbr,acronym,b,bdo,big,blink,cite,code,dfn,'+
'em,kbd,i,q,samp,small,span,strong,sub,sup,tt,var',

SELECTOR_INLINE_SEPARATOR = 'br,hr',

SELECTOR_WHITESPACE_IMPORTANT = 'code,pre',

/** Bias lookup table for getTagNameBias */
TAG_NAME_BIAS = {
  a:-1, address:-3, article:100, aside:-200, blockquote:3, button:-100, dd:-3,
  div:20, dl:-10, dt:-3, figcaption: 10, figure: 10, footer:-20, font:0, form: -20, 
  header: -5, h1: -2, h2: -2, h3: -2, h4: -2, h5: -2, h6: -2, li: -20, nav: -50,
  ol:-20, p:10, pre:3, section:10, small:-1,td:3, time:-3, tr:1, th:-3, ul:-20
},

ID_CLASS_BIAS = {
  about: -35, 'ad-': -100, ads: -50, advert: -100, article: 100,
  attachment: 20, author: 20, blog: 20, body: 50, brand: -50,
  button: -100, byline: 20, carousel: 30, comic: 75,
  comment: -300, component: -50, contact: -50, content: 50, dcsimg: -100,
  entry: 50, excerpt: 20, facebook: -100, fn:-30, foot: -100, google: -50, 
  head: -50, hentry:150, insta: -100, left: -75, license: -100,
  link: -100, logo: -50, main: 50, menu: -200, meta: -50, nav: -200, 
  parse: -50, pinnion: 50, post: 50, power: -100, promo: -200, recap: -100, 
  relate: -300, right: -100, scroll: -50, share: -200, shop: -200, 
  shout: -200, side: -200, sig: -50, social: -200, source:-50, 
  sponsor: -200, story: 50, summary:50, tag: -100, text: 20, time:-30, 
  title: -100,tool: -200, twitter: -200,txt: 50, week: -100, widg: -200,
  zone: -50
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
  strong:1, b:1
},

/** These ancestor elements bias all descendants. */
ANCESTOR_BIAS = {
  nav:-20, div:1, header:-5, table:-2, ol:-5, ul:-5, li:-3,
  dl:-5, p:10, blockquote:10, pre:10, code:10
};

/** public API */
return {
  transform: transformDocument
}

/**
 * Returns a DocumentFragment containing 
 * the content element(s) of an HTMLDocument object
 */
function transformDocument(doc, options) {
  options = options || {};

  eachNode(doc.body, NodeFilter.SHOW_COMMENT, removeNode);
  each(doc.body.querySelectorAll(SELECTOR_REMOVABLE), removeNode);

  // Always unwrap noscript elements pre processing. This must happen before
  // checking visibility.
  each(doc.body.querySelectorAll('noscript'), unwrapElement);

  each(doc.body.querySelectorAll('*'), filterInvisibleElement);
  each(doc.body.getElementsByTagName('img'), filter1DImage);

  // BUGGY: in process of fixing
  // each(doc.body.querySelectorAll(SELECTOR_INLINE_SEPARATOR), transformRuleElement);

  each(doc.body.querySelectorAll(SELECTOR_WHITESPACE_IMPORTANT), cascadeWhitespaceImportant);
  eachNode(doc.body, NodeFilter.SHOW_TEXT, trimAndMaybeRemoveTextNode);
  pruneEmptyElements(doc);

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
  var bestElement = reduce.call(doc.body.getElementsByTagName('*'), 
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
 * Collects some basic textual properties of the node
 * and stashes them in the native object. Propagates the 
 * properties up the DOM to doc.body.
 */
function deriveTextFeatures(textNode) {

  var root = textNode.ownerDocument.body, 
    parent = textNode.parentElement, 
    value = textNode.nodeValue,
    charCount = 0;

  // TODO: this attribute should be discrete not continuous
  parent.copyrightCount = /[\u00a9]|&copy;|&#169;/i.test(value) ? 1 : 0;
  parent.dotCount = countChar(value,'\u2022');
  parent.pipeCount = countChar(value,'|');
  charCount = value.length - value.split(/[\s\.]/g).length + 1;

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

  var text = ((element.getAttribute('id') || '') + ' ' + 
    (element.getAttribute('class') || '')).trim().toLowerCase();

  if(text) {
    element.attributeText = text;
  }
}

/**
 * Apply our 'model' to an element. We generate a 'score' that is the 
 * sum of several terms.
 */
function scoreElement(element) {

  var root = element.ownerDocument.body;

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
        element.score += 250;
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
        element.score += 60;
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

  if(element.matches('img')) {

    var imageDescription = (element.getAttribute('alt') || '').trim();
    if(!imageDescription) imageDescription = (element.getAttribute('title') || '').trim();
    if(imageDescription) {
      // Award those images with alt or title text as being more 
      // likely to be content. Boilerplate images are less likely to 
      // have supporting text.
      element.score += 30;

      // Reward its parent
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 10;
      }

      // TODO: rather than an arbitrary amount, use keyword bias and also 
      // consider a length based bias. If length based used the greater length
      // of either alt or title, do not just consider alt length, which this 
      // branch precludes atm.
    }

    if(element.parentElement && element.parentElement.matches('figure')) {
      var figCaptionNodeList = element.parentElement.getElementsByTagName('figcaption');
      if(figCaptionNodeList && figCaptionNodeList.length) {
        var firstFigCaption = figCaptionNodeList[0];
        var firstFigCaptionText = firstFigCaption.textContent;
        if(firstFigCaptionText) firstFigCaptionText = firstFigCaptionText.trim();
        if(firstFigCaptionText.length) {
          element.score += 30;
          if(element.parentElement && element.parentElement != root) {
            element.parentElement.score = (element.parentElement.score || 0) + 10;
          }
        }
      }
    }

    var area = getImageArea(element);
    if(!isFinite(area)) {
      // The only way to do this synchronously is to have 
      // the dimensions be explicitly set when fetched prior to calling transform.
      // Which means the DOM must be inspected and we have to wait for another 
      // set of requests to complete prior to this. Calamine should not be
      // the module responsible for determining image size.
      // I think it would make sense to decouple HTML fetching in FeedHttpRequest
      // into a separate HTMLHttpRequest, which itself does not invoke its async
      // callback until its inspected the doc, found all images without width or 
      // height, fetched those images, and set width or height.
      element.imageBranch = 1;
      element.score += 100;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 100;
      }
    } else if(area > 1E5) {
      element.imageBranch = 2;
      element.score += 150;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 150;
      }
    } else if(area > 50000) {
      element.imageBranch = 3;
      element.score += 150;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 150;
      }
    } else if(area > 10000) {
      element.imageBranch = 4;
      element.score += 70;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 70;
      }
    } else if(area > 3000) {
      element.imageBranch = 5;
      element.score += 30;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 10;
      }
    } else if(area > 500) {
      element.imageBranch = 6;
      element.score += 10;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) + 10;
      }
    } else {
      element.imageBranch = 7;
      element.score -= 10;
      if(element.parentElement && element.parentElement != root) {
        element.parentElement.score = (element.parentElement.score || 0) - 10;
      }
    } 
  }

  element.score += element.siblingCount ? 
    2 - 2 * element.previousSiblingCount / element.siblingCount : 0;
  element.score += element.siblingCount ? 
    2 - 2 * (Math.abs(element.previousSiblingCount - (element.siblingCount / 2) ) / 
      (element.siblingCount / 2) )  : 0;

  element.score += TAG_NAME_BIAS[element.localName] || 0;

  if(element.attributeText) {
    element.score += ID_CLASS_KEYS.reduce(function(sum, key, index) {
      return element.attributeText.indexOf(key) > -1 ?
        sum + ID_CLASS_VALUES[index] : sum;
    }, 0);

    // TODO: propagate partial attribute text bias to children, in the same 
    // way that certain ancestor elements bias their children? After all, 
    // <article/> should be nearly equivalent to <div id="article"/>
  }

  element.score += -20 * (element.copyrightCount || 0);
  element.score += -20 * (element.dotCount || 0);
  element.score += -10 * (element.pipeCount || 0);

  var ancestorBias = ANCESTOR_BIAS[element.localName];
  ancestorBias && each(element.getElementsByTagName('*'), function(childElement) {
    childElement.score = (childElement.score || 0) + ancestorBias;
  });

  var descendantBias = DESCENDANT_BIAS[element.localName];
  if(descendantBias && element.parentElement != root) {
    element.parentElement.score = (element.parentElement.score || 0) + descendantBias;
  }
}

/**
 * Returns the area of an image, in pixels. If the image's dimensions are
 * undefined, then returns undefined. If the image's dimensions are 
 * greater than 800x600, then the area is clamped.
 */
function getImageArea(element) {
  // TODO: use offsetWidth and offsetHeight instead?
  if(isFinite(element.width) && isFinite(element.height)) {
    var area = element.width * element.height;

    // Clamp to 800x600
    if(area > 360000) {
      area = 360000;
    }

    return area;
  }
}

/**
 * Cache a count of siblings and a count of prior siblings
 *
 * TODO: see if there is a better way to get a node's own index in 
 * the childNodes property of the parent without calculating it ourself.
 */
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
 *
 * TODO: instead of biasing the siblings based on the element, 
 * bias the element itself based on its siblings. Rather, only
 * bias the element itself based on its prior sibling. That way,
 * we can bias while iterating more easily because we don't have to
 * abide the requirement that nextSibling is scored. Then it is
 * easy to incorporate this into the scoreElement function
 * and deprecate this function.
 */
function applySiblingBias(element) {
  var elementBias = element.score > 0 ? 5 : -5;
  var sibling = element.previousElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    sibling.score += elementBias;
    sibling = sibling.previousElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      sibling.score += elementBias;
    }
  }

  sibling = element.nextElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    sibling.score += elementBias;
    sibling = sibling.nextElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      sibling.score += elementBias;
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

/**
 * Sets some html attributes for debugging
 */
function exposeAttributes(element, options) {
  options.SHOW_BRANCH && element.branch && element.setAttribute('branch', element.branch);
  options.SHOW_ANCHOR_DENSITY && element.anchorDensity && 
    element.setAttribute('anchorDensity', element.anchorDensity.toFixed(2));
  options.SHOW_CHAR_COUNT && element.charCount && element.setAttribute('charCount', element.charCount);
  options.SHOW_COPYRIGHT_COUNT && element.copyrightCount && 
    element.setAttribute('copyrightCount', element.copyrightCount);
  options.SHOW_DOT_COUNT && element.dotCount && element.setAttribute('dotCount', element.dotCount);
  options.SHOW_IMAGE_BRANCH && element.imageBranch && element.setAttribute('imageBranch', element.imageBranch);
  options.SHOW_PIPE_COUNT && element.pipeCount && element.setAttribute('pipeCount', element.pipeCount);
  options.SHOW_SCORE && element.score && element.setAttribute('score', element.score.toFixed(2));
}

/**
 * Remove an element if it is not visible
 *
 * NOTE: this does not consider offscreen elements (e.g. left:-100%;right:-100%;)
 * as invisible.
 * NOTE: this does not consider dimensionless elements as invisible 
 * (e.g. width:0px). Certain elements exhibit strange behaviors, like SPAN,
 * that report no width/height, even when the element contains non-empty
 * descendants. We cannot do anything about the native objects reporting
 * 'incorrect' properties, so we cannot filter using this condition.
 */
function filterInvisibleElement(element) {
  // We have to check whether the element is defined because an ancestor of the element
  // may have been removed in a prior iteration, in the case of nested invisible elements,
  // and also because of iteration order, in that if this is called from getElementsByTagName,
  // then in document order, the parent element comes before the child element, meaning that
  // a hidden parent that is removed means the children should never be reached. But they 
  // are reached for some reason, so we have to check.
  if(element && (element.style.display == 'none' || element.style.visibility == 'hidden' || 
      parseInt(element.style.opacity) === 0)) {
    element.remove();
  }
}

/**
 * Remove a an image if it is 'one-dimensional'
 *
 * TODO: use offsetWidth and offsetHeight?
 */
function filter1DImage(element) {
  if(element && (element.width == 1 || element.height == 1)) {
    element.remove();
  }
}

/**
 * Removes attributes
 *
 * NOTE: using filter avoids the issue with removing while iterating.
 * NOTE: attribute.ownerElement is deprecated so we no way of referencing
 * the element unless we specify the forEach function here.
 */
function filterElementAttributes(element) {
  filter.call(element.attributes, isRemovableAttribute).forEach(function(attribute) {
      element.removeAttribute(attribute.name);
  });
}

/**
 * Returns true if an attribute is removable. We only allow 
 * href and src. All other attributes are removed.
 */
function isRemovableAttribute(attribute) {
  return attribute.name != 'href' && attribute.name != 'src';
}

/**
 * Replaces each occurrence of <br/> or <hr/> with <p></p>.
 * NOTES: this was never working correctly, under heavy construction
 */
function transformRuleElement(element) { 

  // Notes: can maybe use element.before, element.after?
  // Or element.insertAdjacentHTML but this involves serialization which would be pointless

  // See http://balkin.blogspot.com/2014/06/hobby-lobby-part-xv-theres-no-employer.html
  // BUGGY

  // The behavior changes based on where the rule is located: whether it is 
  // adjacent to text or inline elements or not, and whether it is within its own blocking element
/*
  var root = element.ownerDocument.body;
  var blockParent = element.parentElement;
  var inlineParents = [];

  while(blockParent != root && blockParent.matches(SELECTOR_INLINE)) {
    inlineParents.push(blockParent);
    blockParent = blockParent.parentElement;
  }

  // Start a second path starting from a clone of the block parent
  // that follows the original block parent, unless block parent
  // is body
  if(blockParent == root) {

  } else {
    // Start the the path with a clone of the block parent 
    // as the nextSibling of the block parent.
    var blockParentClone = blockParent.cloneNode(false);
    
    // NOTE: looks like chrome does not support it
    blockParent.after(blockParentClone);
    //if(blockParent.nextSibling) {
    //  blockParent.parentElement.insertBefore(blockParentClone, blockParent.nextSibling);
    //} else {
    //  blockParent.parentElement.appendChild(blockParentClone);
    //}

    // Recreate the inline element parents path
    var pathParent = null, pathParentClone = null;
    while(inlineParents.length) {
      pathParent = inlineParents.pop();
      pathParentClone = pathParent.cloneNode(false);
    }
  }
*/
  // Recreate the path
  /*
  var cursor = blockParent;
  while(inlineParents.length) {
    pathParent = inlineParents.pop();
    pathParentClone = pathParent.cloneNode(false);
    
    if(cursor == blockParent) {
      // Insert path parent clone following the original parent
      if(pathParent.nextSibling) {
        blockParent.insertBefore(pathParentClone, pathParent.nextSibling);
      } else {
        blockParent.appendChild(pathParentClone);
      }
      
    } else {
      // Insert pathParentClone under cursor
      cursor.appendChild(pathParentClone);
    }
    cursor = pathParentClone;
  }*/
}

/**
 * Marks the current element as whitespaceImportant and then
 * marks all direct and indirect descendants as whiteSpace important.
 * Propagating from the top down (cascading) allows us to quickly
 * determine whether text is trimmable as opposed to searching each 
 * text node's axis (path from root) for the presence of a 
 * whitespaceImportant element.
 */
function cascadeWhitespaceImportant(element) {
  setWhitespaceImportant(element);
  each(element.getElementsByTagName('*'), setWhitespaceImportant);
}

function setWhitespaceImportant(element) {
  element.whitespaceImportant = 1;
}


/**
 * Trims a text node. If the text node is sandwiched between
 * two inline elements, it is not trimmed. If the text node
 * only follows an inline element, it is right trimmed. If 
 * the text node only precedes an inline element, it is left
 * trimmed. Otherwise, nodeValue is fully trimmed.
 *
 * Then, if nodeValue if falsy (undefined/empty string), 
 * the node is removed.
 */
function trimAndMaybeRemoveTextNode(node) {
  if(!node.parentElement.whitespaceImportant) {
    if(isInlineElement(node.previousSibling)) {
      if(!isInlineElement(node.nextSibling)) {
        node.nodeValue = node.nodeValue.trimRight();
      }
    } else if(isInlineElement(node.nextSibling)) {
      node.nodeValue = node.nodeValue.trimLeft();
    } else {
      // Going with native trim for now but a loop might be better.
      // http://blog.stevenlevithan.com/archives/faster-trim-javascript
      // http://jsperf.com/mega-trim-test
      node.nodeValue = node.nodeValue.trim();
    }

    if(!node.nodeValue) {
      node.remove();
    }
  }
}

/** 
 * Get parent of element with side effect of removing the element. This exists
 * primarily because it is necessary to cache the reference to parentElement
 * before removing the element. Once an element is removed it no longer 
 * has a parentElement, unless it was an ancestor of the element that was 
 * actually removed. But we know we are directly removing the element here and not 
 * an ancestor, so caching the parentElement reference is sometimes necessary.
 */
function removeElementAndReturnParent(element) {
  var parentElement = element.parentElement;
  parentElement.removeChild(element);
  return parentElement;
}

/**
 * Returns true if the element is fertile but childless
 */
function isEmptyLikeElement(element) {
  return !element.firstChild && !element.matches(SELECTOR_LEAFY);
}

/**
 * TODO: Using stack is unecessary. We can instead just find 
 * the parent to remove. No need for an array, stack, etc.
 * That was per element. Here we have an array of parents to 
 * remove, so a stack makes a bit of sense. What I really mean
 * is that removes should happen only once on the shallowest
 * parent. If this were on a live doc we would be causing 
 * several unecessary reflows. Nevertheless I know we are 
 * not on a live doc so the inefficiency of this is not 
 * really punishing, and at the moment, the behavior is 
 * accurate.
 *
 * In other words, in the case of <div><p></p><p></p></div>,
 * there are 3 remove operations, when only 1 needed to occur.
 */
function pruneEmptyElements(doc) {

  // Use our own filter here because :empty is bunk
  var root = doc.body, parent, grandParent,
    stack = filter.call(
      doc.body.getElementsByTagName('*'), isEmptyLikeElement).map(
        removeElementAndReturnParent);

  // The removal of any element could leave its parent empty, meaning
  // we must remove the parent too (unless its doc.body).
  while(stack.length) {
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

/**
 * Returns true if the node is a defined element that 
 * is considered inline. Essentially elements by default behave 
 * according to either "display: block" or "display: inline". This can be changed
 * by CSS but calamine ignores that fact and returns to the most basic
 * assumptions about the natural behavior based on the element's type. In other words,
 * <p> is a block, but <span> is inline.
 *
 * Note: divs are technically inline, but are frequently used instead as blocks, so
 * divs are not considered inline.
 */
function isInlineElement(node) {
  return node && node.nodeType == Node.ELEMENT_NODE && node.matches(SELECTOR_INLINE);
}

/**
 * Returns the frequency of ch in str.
 *
 * Note: http://jsperf.com/count-the-number-of-characters-in-a-string
 * The alternate way is return str.split('|').length - 1;
 */
function countChar(str, ch) {
  for(var count = -1, index = 0; index != -1; count++) {
    index = str.indexOf(ch, index+1);    
  }
  return count;
}

/**
 * A simple forEach for objects. This is useful primarily for objects
 * like HTMLCollection/NodeList objects that are returned by calls
 * to querySelectorAll or getElementsByTagName that do not provide a native
 * forEach method but support indexed property access.
 */
function each(obj, func) {
  for(var i = 0, len = obj ? obj.length : 0; i < len; 
    func(obj[i++])) {
  }
}

/**
 * Simple helper to use foreach against traversal API. Filter is optional.
 */
function eachNode(element, type, func, filter) {
  var node, iterator = element.ownerDocument.createNodeIterator(element, type, filter);
  while(node = iterator.nextNode()) { func(node); }
}

/**
 * Removes the element but retains its children. Useful for 
 * removing 'wrapper' style elements like span/div/form. This is like
 * element.remove() but we keep the children.
 *
 * TODO: element.replace(element.childNodes) ???
 * See http://dom.spec.whatwg.org/#childnode.
 * It looks like Chrome currently supports ChildNode.remove but 
 * does not support replace/after/before.
 */
function unwrapElement(element) {
  // We have to check element is defined since this is called every iteration
  // and a prior iteration may have somehow removed the element.

  // We check parent element just in case this is somehow called on an 
  // element that was removed. This can work on detached nodes, but only
  // if those nodes still have a parentElement defined. The root of a detached
  // hierarchy does not, but its children do.

  if(element && element.parentElement) {
    while(element.firstChild) {
      element.parentElement.insertBefore(element.firstChild, element);
    }

    element.remove();
    //element.parentElement.removeChild(element);    
  }
}

/**
 * For passing to iterators like forEach
 */
function removeNode(node) {
  //if(node && node.parentNode) {
  //  node.parentNode.removeChild(node);
  //}

  if(node) {
    node.remove();
  }
}

}()); 