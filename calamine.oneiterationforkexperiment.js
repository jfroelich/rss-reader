/**
 * Copyright 2014 Josh Froelich. MIT licensed.
 *
 * A simple module for removing boilerplate from web pages.
 *
 * TODO: support for iframes and embed objectsa and audio/video
 * TODO: refactor to use a single iteration prior to block generation
 * TODO: refactor to use block generation. Group lis together. Group
 * dds together, etc.
 * TODO: refactor to use block weighting. The return signature is simply
 * those blocks above a minimum threshold, which could be based on a 
 * percentage of blocks to return value. But this time use the element
 * weighting technique. Consider treating divs as inline and using 
 * only certain block parents (e.g. look for ul/ol/p/img/iframe as the only 
 * allowable block segments).
 * TODO: performance testing, memory testing
 */
var calamine = (function() {
'use strict';

var filter = Array.prototype.filter,
reduce = Array.prototype.reduce,

/** Remove these elements, including children */
SELECTOR_REMOVABLE = 'applet,base,basefont,button,command,datalist,'+
'dialog,fieldset,frame,frameset,img:not([src]),input,'+
'link,math,meta,noframes,option,optgroup,output,script,'+
'select,style,textarea',

//SELECTOR_BLOCK = 'audio,embed,iframe,img,ol,p,ul,video',

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
 * Returns coherent element(s) of an HTMLDocument object
 */
function transformDocument(doc, options) {

  var height, idClassText, removedElement, sibling, width;

  options = options || {};

  for(var node, nodeIterator = doc.createNodeIterator(doc.body,NodeFilter.SHOW_ALL); 
    node = nodeIterator.nextNode();) {

    if(node.nodeType == Node.COMMENT_NODE) {
      node.parentNode.removeChild(node);
    } else if(node.nodeType == Node.ELEMENT_NODE) {

      if(node.matches(SELECTOR_REMOVABLE)) {        
        node.remove();
        //removeElementAndAncestorsIfEmpty(node.parentElement);
        continue;
      }

      if(isInvisibleElement(node)) {
        node.remove();
        //removeElementAndAncestorsIfEmpty(node.parentElement);
        continue;
      }

      if(isOneDimensionalImage(node)) {
        node.remove();
        //removeElementAndAncestorsIfEmpty(node.parentElement);
        continue;
      }

      if(node.matches('noscript')) {
        unwrapElement(node);
        //removeElementAndAncestorsIfEmpty(node.parentElement);
        continue;
      }

      //transformRuleElement

      // BUG: this is stripping too much stuff
      /*removedElement = removeElementAndAncestorsIfEmpty(node);
      if(removedElement) {
        continue;
      }*/


      if(node.matches('code,pre')) {
        setWhitespaceImportant(node);
        each(node.getElementsByTagName('*'), setWhitespaceImportant);
      }

      // Setup the inAnchor flag so that direct and indirect 
      // descendant text nodes will propagate the anchorCharCount property 
      // back upward to this anchor (and higher if 
      // not-well-formed nested anchor).
      if(node.matches('a') && node.hasAttribute('href')) {
        // Set it to true on ourself.
        node.inAnchor = 1;
        each(node.getElementsByTagName('*'), function(child) {
          child.inAnchor = 1;
        });
      }

      // Cache attribute features before removing attributes
      if(idClassText = ((node.getAttribute('id') || '') + ' ' + 
        (node.getAttribute('class') || '')).trim().toLowerCase()) {
        node.attributeText = idClassText;
      }

      if(width = parseInt(node.getAttribute('width'))) {
        node.attributeWidth = width;
      }

      if(height = parseInt(node.getAttribute('height'))) {
        node.attributeHeight = height;
      }

      // Remove attributes. Using filter creates an array so we can avoid 
      // issues with removing items while iterating a live collection.
      // Note: we cannot use attribute.ownerElement because it is deprecated
      filter.call(node.attributes, isRemovableAttribute).forEach(function(attribute) {
          node.removeAttribute(attribute.name);
      });

      // Derive sibling features
      node.siblingCount = node.parentElement.childElementCount - 1;
      node.previousSiblingCount = 0;

      if(node.siblingCount) {
        sibling = node.previousElementSibling;
        while(sibling) {
          node.previousSiblingCount++;
          sibling = sibling.previousElementSibling;
        }
      }

    } else if(node.nodeType == Node.TEXT_NODE) {
      // Trim it
      trimNode(node);

      // If it is empty, remove it, and possibly remove its ancestors
      if(!node.nodeValue) {
        node.remove();

        removeElementAndAncestorsIfEmpty(node.parentElement);
        continue;
      }


      var parent = node.parentElement;
      var value = node.nodeValue;
      parent.hasCopyright = /[\u00a9]|&copy;|&#169;/i.test(value) ? 1 : 0;
      parent.dotCount = countChar(value,'\u2022');
      parent.pipeCount = countChar(value,'|');
      var charCount = value.length - value.split(/[\s\.]/g).length + 1;

      // Propagate text properties from the bottom up to the root, excluding
      // the body. 
      // NOTE: Text nodes at the body level are therefore ignored? That might
      // be really bad: <html><body>my entire article<br>text</body></html>
      // We have to remember to find top level text nodes when creating blocks.
      // Also, we have no way of knowing if they are good nodes?
      while(parent != doc.body) {

        parent.charCount = (parent.charCount || 0) + charCount;
        
        // Since parent changes each step of the walk we have to check
        // each step if we traversed outside of an anchor branch
        if(parent.inAnchor) {
          // Parent is either an anchor or a direct or indirect descendant
          // element of an anchor, so update its anchorCharCount property.
          parent.anchorCharCount = (parent.anchorCharCount || 0) + charCount;
        }
          
        parent = parent.parentElement;
      }
    }
  }

  // Temp while testing.
  var results = doc.createDocumentFragment();
  each(doc.body.childNodes, function(element) {
    if(element) {
      results.appendChild(element);  
    }
  });
  return results;
}


function trimNode(node) {
  if(!node.parentElement.whitespaceImportant) {
    if(isInlineElement(node.previousSibling)) {
      if(!isInlineElement(node.nextSibling)) {
        node.nodeValue = node.nodeValue.trimRight();
      }
    } else if(isInlineElement(node.nextSibling)) {
      node.nodeValue = node.nodeValue.trimLeft();
    } else {
      node.nodeValue = node.nodeValue.trim();
    }
  }  
}

/**
 * Test whether an element is 'invisible'
 */
function isInvisibleElement(element) {
  return element.style.display == 'none' || element.style.visibility == 'hidden' || 
      parseInt(element.style.opacity) === 0;
}

function isOneDimensionalImage(element) {
  return element.matches('img') && (element.width == 1 || element.height == 1);
}

/** Removes attributes */
function filterElementAttributes(element) {
  // NOTE: filtering avoids the issue with removing while iterating
  // NOTE: attribute.ownerElement is deprecated so we must create the 
  // function every time.
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

function setWhitespaceImportant(element) {
  element.whitespaceImportant = true;
}


function removeElementAndAncestorsIfEmpty(element) {
  if(!element) {
    return;
  }

  var root = element.ownerDocument.body;

  // If the element is not empty or is leafy, do nothing, and 
  // return undefined
  if(element.firstChild || element.matches(SELECTOR_LEAFY)) {
    return;
  }

  // Walk upwards to find the shallowest ancestor to target for removal
  // Assume empty text nodes have been stripped at some point. For example,
  // if we have <p>\n<b></b>\n</p>, the p will eventually be removed because the 
  // handler for the second \n node also calls this function on the 
  // parent element after removing empty text node.
  while(element != root && element.parentElement.childNodes.length == 1) {
    element = element.parentElement;
  }

  // Remove the element
  element.remove();
  return element;
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
 * Removes the element but retains its children. Useful for 
 * removing 'wrapper' style elements like span/div/form
 *
 * TODO: element.replace(element.childNodes) ???
 * See http://dom.spec.whatwg.org/#childnode
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

}()); 