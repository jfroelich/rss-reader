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
 * Also consider the following shorthand
 * https://developer.mozilla.org/en-US/docs/Web/API/ChildNode.remove
 */
var calamine = (function(exports) {
'use strict';


/* Filter alias */
var filter = Array.prototype.filter, 

/* Reduce alias */
reduce = Array.prototype.reduce,


/** Remove these elements, including children */
SELECTOR_REMOVABLE = 'applet,base,basefont,button,command,datalist,'+
'dialog,embed,fieldset,frame,frameset,head,iframe,img:not([src]),input,'+
'link,math,meta,noframes,object,option,optgroup,output,param,script,'+
'select,style,title,textarea',

/** Remove these elements, excluding children, if OPTIONS.UNWRAP_UNWRAPPABLE is set */
SELECTOR_UNWRAPPABLE = 'a:not([href]),big,blink,body,center,div,font,form,'+
'html,legend,small,span,tbody,thead',

/**
 * Elements that should not be considered empty nor containing scorable text
 */
SELECTOR_LEAFY = 'applet,audio,br,canvas,embed,frame,hr,iframe,img,object,video',

SELECTOR_INLINE = 'a,abbr,acronym,b,bdo,big,blink,cite,code,dfn,'+
'em,kbd,i,q,samp,small,span,strong,sub,sup,tt,var',

SELECTOR_INLINE_SEPARATOR = 'br,hr',

/** Bias lookup table for getTagNameBias */
TAG_NAME_BIAS = {
  a:-1, address:-3, article:100, aside:-200, blockquote:3, button:-100, dd:-3,
  div:20, dl:-10, dt:-3, figcaption: 10, figure: 10, footer:-20, font:0, form: -20, 
  header: -5, h1: -2, h2: -2, h3: -2, h4: -2, h5: -2, h6: -2, li: -20, nav: -50,
  ol:-20, p:10, pre:3, section:10, small:-1,td:3, time:-3, tr:1, th:-3, ul:-20},

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


  // BUGGY: in process of fixing
  // each(doc.body.querySelectorAll(SELECTOR_INLINE_SEPARATOR), transformRuleElement);

  each(doc.body.getElementsByTagName('pre'), cascadeWhitespaceImportant);
  each(doc.body.getElementsByTagName('code'), cascadeWhitespaceImportant);
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
      if(element.parentElement && element.parentElement != element.ownerDocument.body) {
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
          console.log('Rewarding %s for caption text', element.outerHTML);
          // This image had a caption associated with it. Reward it.
          element.score += 30;
          if(element.parentElement && element.parentElement != element.ownerDocument.body) {
            element.parentElement.score = (element.parentElement.score || 0) + 10;
          }
        }
      }
    }

    var area = getImageArea(element);
    if(!isFinite(area)) {
      // The only way to do this synchronously without async taint is to have 
      // the dimensions be explicitly set when fetched prior to calling transform.
      // Which means the DOM must be inspected and we have to wait for another 
      // set of requests to complete prior to this. Calamine itself cannot be
      // the module responsible for determining unknown image sizes.
      // I think it would make sense to decouple HTML fetching in FeedHttpRequest
      // into a separate HTMLHttpRequest, which itself does not invoke its async
      // callback until its inspected the doc, found all images without width or 
      // height, fetched those images, and set width or height.
      element.imageBranch = 1;
      element.score += 100;
      if(element.parentElement && element.parentElement != element.ownerDocument.body) {
        element.parentElement.score = (element.parentElement.score || 0) + 100;
      }
    } else if(area > 100000) {
      element.imageBranch = 2;
      element.score += 150;
      if(element.parentElement && element.parentElement != element.ownerDocument.body) {
        element.parentElement.score = (element.parentElement.score || 0) + 150;
      }
    } else if(area > 50000) {
      element.imageBranch = 3;
      element.score += 150;
      if(element.parentElement && element.parentElement != element.ownerDocument.body) {
        element.parentElement.score = (element.parentElement.score || 0) + 150;
      }
    } else if(area > 10000) {
      element.imageBranch = 4;
      element.score += 70;
      if(element.parentElement && element.parentElement != element.ownerDocument.body) {
        element.parentElement.score = (element.parentElement.score || 0) + 70;
      }
    } else if(area > 3000) {
      element.imageBranch = 5;
      element.score += 30;
      if(element.parentElement && element.parentElement != element.ownerDocument.body) {
        element.parentElement.score = (element.parentElement.score || 0) + 10;
      }
    } else if(area > 500) {
      element.imageBranch = 6;
      element.score += 10;
      if(element.parentElement && element.parentElement != element.ownerDocument.body) {
        element.parentElement.score = (element.parentElement.score || 0) + 10;
      }
    } else {
      element.imageBranch = 7;
      element.score -= 10;
      if(element.parentElement && element.parentElement != element.ownerDocument.body) {
        element.parentElement.score = (element.parentElement.score || 0) - 10;
      }
    } 
  }

  element.score += element.siblingCount ? 
    (2 - 2 * element.previousSiblingCount / element.siblingCount) : 0;
  element.score += element.siblingCount ? 
    (2 - 2 * (Math.abs(element.previousSiblingCount - (element.siblingCount / 2) ) / 
      (element.siblingCount / 2) ) ) : 0;

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

function getImageArea(element) {
  var width = element.width || element.getAttribute('width') || element.style.width;
  var height = element.height || element.getAttribute('height') || element.style.height;
  width = parseInt(width);
  height = parseInt(height);

  if(isFinite(width) && isFinite(height)) {
    var area = width * height;

    if(area > 360000) {
      area = 360000;
    }

    return area;
  }

  // Return a default approximate area
  return NaN;
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
 *
 * TODO: consider refactoring to just bias the element itself
 * based on its siblings, instead of biasing the siblings. If we
 * are doing this while scoring then only previousSibling is 
 * available.
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

function exposeAttributes(element, options) {

  if(options.SHOW_BRANCH && element.branch) {
    element.setAttribute('branch', element.branch);
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

  if(options.SHOW_IMAGE_BRANCH && element.imageBranch) {
    element.setAttribute('imageBranch', element.imageBranch);
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
    element.parentElement.removeChild(element);
  } else if(element.style.visibility == 'hidden') {
    element.parentElement.removeChild(element);
  } else if(isFinite(element.style.opacity) && parseInt(element.style.opacity) === '0') {
    element.parentElement.removeChild(element);
  } else {
    var width = element.width || element.getAttribute('width') || element.style.width;
    var height = element.height || element.getAttribute('height') || element.style.height;
    if(parseInt(height) === 0 || parseInt(width) === 0) {
      element.parentElement.removeChild(element);
    }
  }
}

function filter1DImage(element) {
  if(element) {
    // TODO: would element.width ever be set if the others were not?
    var width = element.width || element.getAttribute('width') || element.style.width;
    var height = element.height || element.getAttribute('heigh') || element.style.height;
    width = width ? parseInt(width, 10) : 0;
    height = height ? parseInt(height, 10) : 0;

    // Remove 1x1 or 1xY or Yx1
    if(width == 1 || height == 1) {
      element.parentElement.removeChild(element);
    }
  }
}

/** Removes attributes */
function filterElementAttributes(element) {
  // NOTE: filtering avoids the issue with removing while iterating
  // NOTE: attribute.ownerElement is deprecated (sigh)
  filter.call(element.attributes, isRemovableAttribute).forEach(function(attribute) {
      element.removeAttribute(attribute.name);
  });
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

  // See http://balkin.blogspot.com/2014/06/hobby-lobby-part-xv-theres-no-employer.html
  // BUGGY



  // The behavior changes based on where the rule is located: whether it is 
  // adjacent to text or inline elements or not, and whether it is within its own blocking element

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

    if(blockParent.nextSibling) {
      blockParent.parentElement.insertBefore(blockParentClone, blockParent.nextSibling);
    } else {
      blockParent.parentElement.appendChild(blockParentClone);
    }

    // Recreate the inline element parents path
    var pathParent = null, pathParentClone = null;
    while(inlineParents.length) {
      pathParent = inlineParents.pop();
      pathParentClone = pathParent.cloneNode(false);

    }
  }

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



  // We are splitting the hierarchy at the deepest blocking ancestor
  // then moving all nodes to the a partial clone of the hierarchy

  // Recreate the path up to the block parent
  /*var ps = element.previousSibling;
  var psTextNodesOrInlineElements = [];

  while(ps && (ps.nodeType == Node.TEXT_NODE || isInlineElement(ps))) {
    psTextNodesOrInlineElements.push(ps);
    ps = ps.previousSibling;
  }

  var ns = element.nextSibling;
  var nsTextNodesOrInlineElements = [];
  while(ns && (ns.nodeType == Node.TEXT_NODE || isInlineElement(ps))) {
    nsTextNodesOrInlineElements.push(ns);
    ns = ns.nextSibling;
  }*/
}

function followsTextNode(element) {
  return element.previousSibling && element.previousSibling.nodeType == Node.TEXT_NODE;
}

function precedesTextNode(element) {
  return element.nextSibling && element.nextSibling.nodeType == Node.TEXT_NODE;
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
    // We are in a PRE/CODE axis of the DOM, so keep the text node
    // exactly as it was.
    return;
  }

  // Going with native trim for now but a loop might be better.
  // http://blog.stevenlevithan.com/archives/faster-trim-javascript
  // http://jsperf.com/mega-trim-test

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
  stack = filter.call(
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