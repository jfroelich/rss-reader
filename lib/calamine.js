// Copyright 2014 Josh Froelich. See LICENSE for details.

var calamine = (function(exports) {
'use strict';

/**
 * Apply calamine to an HTMLDocument object. Mutations
 * are in place.
 */
function transformDocument(doc) {
  preprocessDocument(doc);
  scoreBlockNodes(doc);


}


// walk through all the text nodes. for each text node
// set properties in the parent node. set wordcount and 
// and wordCharCount (the sum of the lengths of the words)

// Note: we can set these as properties of the native node objects
// but for initial development use attributes.

function scoreBlockNodes(doc) {
  var iterator = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);

  var node = null;
  while(node = iterator.nextNode()) {
    var value = node.nodeValue.trim();
    if(!value) {
      continue;
    }

    // Find the closest blocking ancestor of the text node. Any non-inline
    // element can block.
    var blockElement = findBlockAncestor(node, doc.body);

    // Get an array of words from the text
    var tokens = tokenize(value);

    // Get the sum of the lengths of each token
    var tokensCharCount = sumStringsLength(tokens);

    // Shove properties into the native blockElement object
    blockElement.wordCount = blockElement.wordCount ? 
      blockElement.wordCount + tokens.length : tokens.length;
    blockElement.charCount = blockElement.charCount ?
      blockElement.charCount + tokensCharCount : tokensCharCount;
    if(node.parentNode.localName == 'a') {
      blockElement.anchorWordCount = blockElement.anchorWordCount ?
        blockElement.anchorWordCount + tokens.length : tokens.length;
    }
  }

  // Since this is dev and the initial purpose is to get it working
  // we are simply going to iterate again now that each block has 
  // all its children accounted for. Really we should be doing 
  // accumulative scoring in place. But some of our metrics require
  // knowing all of the children. If there is a way to build a 
  // simple list of blocks, that would be great. We cannot simply
  // push each blockparent in the above iteration loop into an array
  // because blockparents are repeated for each text node and we are
  // walking from the bottom up. If there was a simple way to 
  // get a unique id for each blockParent, then we could create 
  // an ordered set. One way would be to define each block parent's 
  // axis, which is its path from the root node to the block + 
  // the offset of the block within its immediate parent. We could also
  // do a naive lookup using ==. Really its equality. Need to see 
  // if there is a way to use node as {} key or see how nodes are 
  // compared for equality (is there a hidden guid prop?).
  // Or wait, here is an idea. Shove a counter called block index
  // into each blockParent the first time it is found. When setting it
  // avoid reseting if it is already set. Then we have a simple way
  // to put the block into a list. Yes. Do that.

  

}

function isNodeFilterAcceptTextNode(node) {
  var value = node.nodeValue.trim();
  return value.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
}

function findBlockAncestor(node, root) {
  var parent = node.parentNode;
  while(parent != root && isInlineElement(parent)) {
    parent = parent.parentNode;
  }
  return parent;
}

var INLINE_ELEMENT = {
  a:1,abbr:1,acronym:1,b:1,bdo:1,big:1,cite:1,code:1,dfn:1,
  em:1,kbd:1,i:1,q:1,samp:1,small:1,span:1,strong:1,sub:1,
  sup:1,tt:1,'var':1
};

function isInlineElement(element) {
  return INLINE_ELEMENT[element.localName];
}



// This is not meant to be complete, see sanitizer for more complete list.
var BAD_TAG_SELECTOR = 'applet,head,form,script,iframe,object,embed,frame,frameset,style';

function preprocessDocument(doc) {
  util.each(doc.querySelectorAll(BAD_TAG_SELECTOR), removeElement);
  
  //http://www.nczonline.net/blog/2010/09/28/why-is-getelementsbytagname-faster-that-queryselectorall/
  util.each(doc.getElementsByTagName('*'), filterAttributes);
  util.each(doc.querySelectorAll('hr,br'), function(node) {
    node.parentNode.insertBefore(doc.createElement('p'), node);
    node.parentNode.remove(node);
  });
  filterArray(doc.querySelectorAll('*'), isEmptyElement).forEach(removeElement);

  // Stripping comments largely just for development purposes
  var commentIt = doc.createNodeIterator(doc,NodeFilter.SHOW_COMMENT);
  var comment = null;
  while(comment = commentIt.nextNode()) {
    comment.parentNode.removeChild(comment);
  }
}

var RETAINABLE_ATTRIBUTE = {id:1,class:1,href:1,src:1};

function filterAttributes(node) {

  var removableAttributes = [];
  
  filterArray(node.attributes, function(attribute) {
    return !RETAINABLE_ATTRIBUTE[attribute.name];
  }).forEach(function(attribute) {
    //node.removeAttribute(attribute.name);
    node.removeAttributeNode(attribute);
  });
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

var reIsNonToken = /&nbsp;|[^A-Za-z0-9@\-_]+/g;

function tokenize(str) {
  //var re = /[\s\b\|]+|&nbsp;/g;
  return str ? str.split(reIsNonToken).filter(isStringWithLength) : [];
}

function isStringWithLength(str) {
  return str && str.length;
}

function sumStringsLength(arrayOfStrings) {
  return arrayOfStrings.reduce(addStringLengthToSum, 0);
}

function addStringLengthToSum(sum, str) {
  return sum + str.length;
}


function filterArray(obj, func) {
  return Array.prototype.filter.call(obj, func);
}


function removeElement(element) {
  if(element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

return {
  transform: transformDocument
  // during debug
  ,tokenize: tokenize
};

}(this));