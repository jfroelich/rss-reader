// Copyright 2014 Josh Froelich. See LICENSE for details.

var calamine = (function(exports) {
'use strict';

/**
 * Apply calamine to an HTMLDocument object.
 */
function transformDocument(doc) {

  // preprocess is doing something very wrong.
  preprocessDocument(doc);
  var blocks = scoreBlockElements(doc);

  var body = findBody(doc, blocks);
  body.style.backgroundColor = 'green';
  //doc.body.innerHTML = body.innerHTML;
  postprocessDocument(doc);
}

function postprocessDocument(doc) {

  // TODO: move strip attributes from preprocess to postprocses

  //util.each(doc.querySelectorAll('div,span'), unwrapElement);
  //util.each(doc.querySelectorAll('span'), unwrapElement);
}


// Walk through all the text nodes. for each text node
// set properties in the parent node. set wordCount and 
// and wordCharCount (the sum of the lengths of the words)

function scoreBlockElements(doc) {
  var iterator = doc.createNodeIterator(doc.body, 
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, function(node) {
    if(node.nodeType == Node.ELEMENT_NODE && node.localName == 'img') {
      return NodeFilter.FILTER_ACCEPT;
    } else if(node.nodeType == Node.TEXT_NODE) {
      return NodeFilter.FILTER_ACCEPT;
    }

    return NodeFilter.FILTER_REJECT;
  });
  var node = null;
  var blockIdCounter = 0;
  var blocks = [];


  // Traverse the nodes and extract features
  while(node = iterator.nextNode()) {
    var value;

    if(node.nodeType == Node.ELEMENT_NODE) {
      if(node.localName != 'img') {
        throw new Error('traversing over non-image elements');
      }
    } else {
      value = node.nodeValue.trim();
      if(!value)
        continue;
    }

    // Find the closest blocking ancestor of the node. Any non-inline
    // element can block.
    var blockElement = findBlockAncestor(node, doc.body);

    // Store blockId if not set. This way we can get easily and 
    // quickly obtain a list of unique block elements in 
    // document order for scoring.
    if(!blockElement.hasOwnProperty('blockId')) {
      blockElement.blockId = blockIdCounter++;
      
      blockElement.contentScore = 0;

      // Denote the block type as image so we can avoid
      // trying to later score image nodes with text features
      if(node.nodeType == Node.ELEMENT_NODE) {
        blockElement.containsImage = 1;
      }

      blocks.push(blockElement);
    }

    if(node.nodeType == Node.ELEMENT_NODE) {
      // There are no features to extract from images
      // so continue iteration
      continue;
    }

    // Extract features of text nodes
    // Get an array of words from the text
    var tokens = tokenize(value);

    // Get the sum of the lengths of each token
    var tokensCharCount = sumStringsLength(tokens);

    // Store features in the native blockElement object
    blockElement.wordCount = blockElement.wordCount ? 
      blockElement.wordCount + tokens.length : tokens.length;
    blockElement.charCount = blockElement.charCount ?
      blockElement.charCount + tokensCharCount : tokensCharCount;
    if(node.parentNode.localName == 'a') {
      blockElement.anchorWordCount = blockElement.anchorWordCount ?
        blockElement.anchorWordCount + tokens.length : tokens.length;
    }
  }

  // Score blocks
  blocks.forEach(function(block) {
    if(!blockElement.containsImage) {
      // Score text-only features
      block.contentScore += getAnchorDensityBias(block);
      block.contentScore += getTextDensityBias(block);
      block.contentScore += getCopyrightBias(block);
    } else {
      // Score image only features
      block.contentScore += 50;
    }

    // These features apply to both images and text
    block.contentScore += getElementDensityBias(block);
    block.contentScore += getPositionBias(block, blocks.length);
    block.contentScore += getElementBias(block);
    block.contentScore += getAttributeBias(block);
  });

  // Propagate scores to nearby siblings
  // apply sibling bias i think is causing the NaNs to appear
  blocks.forEach(applySiblingBias);

  // For review during development, expose the score as an attribute
  blocks.forEach(exposeScoreAttribute);

  return blocks;
}


function findBody(doc, blocks) {



  blocks.forEach(function(block) {
    var parent = block.parentNode;
    if(parent && block.localName != 'body') {
      if(parent.contentScore) {
        parent.contentScore += block.contentScore;
      } else {
        parent.contentScore = block.contentScore;
      }

      parent.contentScore += getElementBias(parent);

      // For development
      parent.setAttribute('score', parent.contentScore.toFixed(2));
    }
  });

  // TODO: sometimes a few pieces of boilerplate are included at the 
  // top/bottom that we would like to filter out. this is largely due 
  // to how simple the body filter is because it is as the container
  // level, and sometimes boilerplate is within the same container.
  
  // TODO: Maybe then we still need to consider 
  // extending to siblings.


  // Get all elements with a score attribute and find the block with 
  // the highest score
  var element, maxElement, maxScore = 0;
  var iterator = doc.createNodeIterator(doc.body, NodeFilter.SHOW_ELEMENT, function(node) {
    return node.contentScore ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
  });

  while(element = iterator.nextNode()) {
    if(element.contentScore > maxScore) {
      maxScore = element.contentScore;
      maxElement = element;
    }
  }

  if(!maxElement) {
    console.warn('No max element, falling back to body');
    maxElement = doc.body;
  } else {

    // Getting an extremely strange bug when the chosen 
    // element is a span element. None of the styles or anything
    // work as expected and Chrome reports the dimensions of the 
    // span as 0, even though the span contains visible dimensional
    // elements.
    if(maxElement.localName == 'span') {
      console.warn('avoiding dimension-less span bug');
      var div = doc.createElement('div');
      maxElement.parentNode.insertBefore(div, maxElement);
      util.each(maxElement.childNodes, function(node) {
        var copy = node.cloneNode(true);
        // cloneNode does not copy over non-native properties?
        copy.contentScore = node.contentScore || 0;
        if(copy.contentScore) {
          copy.setAttribute('score', copy.contentScore);
        }
        div.appendChild(copy);
      });
      div.contentScore = maxElement.contentScore || 0;
      div.setAttribute('score', maxElement.contentScore);
      div.setAttribute('hack','dimensionless span hack');
      maxElement.parentNode.removeChild(maxElement);
      maxElement = div;
    }
  }

  return maxElement;
}


/**
 * Propagate scores to nearby siblings. Look up to 2 elements 
 * away in either direction. The idea is that content generally
 * follows content, and boilerplate generally follows boilerplate.
 * Contiguous blocks should get promoted by virture of their 
 * context.
 */
function applySiblingBias(block) {

  // assert block.contentScore
  //if(block.contentScore === NaN || typeof block.contentScore === 'undefined') {
  //  console.warn('NAN/undefined block.contentScore in applySiblingBias');
  //}

  var sibling = block.previousElementSibling;
  if(sibling) {
    if(!sibling.contentScore) {
      //console.log('setting undefined sibling score to 0');
      sibling.contentScore = 0;
    }

    sibling.contentScore += 0.2 * block.contentScore;
    sibling = sibling.previousElementSibling;
    if(sibling) {
      if(!sibling.contentScore) {
        //console.log('setting undefined sibling sibling score to 0');
        sibling.contentScore = 0;
      }
      sibling.contentScore += 0.1 * block.contentScore;
    }
  }
  sibling = block.nextElementSibling;
  if(sibling) {
    if(!sibling.contentScore) {
      sibling.contentScore = 0;
    }
    sibling.contentScore += 0.2 * block.contentScore;
    sibling = sibling.nextElementSibling;
    if(sibling) {
      if(!sibling.contentScore) {
        sibling.contentScore = 0;
      }
      sibling.contentScore += 0.1 * block.contentScore;
    }
  }

  if(!isFinite(block.contentScore)) {
    console.log('applySiblingBias somehow set contentScore to !isFinite');
  }
}

/**
 * Anchor density is the ratio of the number of tokens within anchors to the number
 * of tokens within the block. Generally, blocks with density lower than 0.35
 * are content.
 *
 * Award points for low anchor density.
 */
function getAnchorDensityBias(block) {
  if(block.wordCount) {
    // Note: anchorWordCount is never defined for blocks without anchors
    var ratio = (block.anchorWordCount || 0) / block.wordCount;
    

    // The threshold of 0.35 is based on results
    // demonstrated in the paper on using shallow features.

    if(ratio > 0.35) {
      // Penalize high link density
      return -50 * ratio;
    } else {
      // Proportionally reward low link density
      return 50 - 50 * ratio;
    }

    return bias;
  } else {
    return 0;
  }
}

/**
 * Content generally contains less formatting, and therefore less tags, 
 * than boilerplate. Based on the BTE algorithm. But note that 
 * early testing shows this barely differentiates between content and 
 * testing. It basically just needlessly inflates the score. I think this 
 * is because of the trend towards using CSS and away from formatting elements
 * like FONT/B/I and so on.
 */
function getElementDensityBias(block) {
  var bias = 10 - 10 * block.childElementCount / (block.charCount || 1);
  return bias;
}

/**
 * Text density is the ratio of word count to line count. Content blocks
 * have higher text densities than boilerplate. According to the research,
 * densities higher than 10.5, or higher than 7 but with link density lower
 * than 0.35, are probably content.
 *
 * We use a very simple heurstic of 60 characters per line. Award up to 
 * 40 points for high text density.
 */
function getTextDensityBias(block) {
  var lineCount = block.charCount > 60 ? block.charCount / 60 : 1;

  // Not all blocks had a word count defined (such as element blocks that contain 
  // images but not text). So set wordCount to 0.
  if(!isFinite(block.wordCount)) block.wordCount = 0;

  var textDensity = block.wordCount / lineCount;
  
  return 6 * (textDensity > 10 ? 10 : textDensity);
}

/**
 * Promote blocks which are earlier in document order. Promote blocks
 * which are closer to the middle in document order. This is a bit naive
 * and arbitrary but generally: content is more likely near the start 
 * of a page than its end, and content is more likely in the center 
 * of the page than at its extremities.
 *
 * Since we promote both, blocks in the first half of the document get 
 * an intentionally inflated score.
 */
function getPositionBias(block, blockCount) {
  var bias = 0;
  var index = block.blockId;

  // Up to 5 points for closest offset to block start
  bias += 5 - 5 * index / blockCount;

  // Up to 5 points for smallest distance from middle
  // in either direction
  var mid = blockCount / 2;
  bias += 5 - 5 * Math.abs(index - mid) / mid;

  return bias; 
}

/**
 * Biases the score based on the name of the block's element. Generally 
 * we promote paragraphs, article containers, and div containers, 
 * and demote everything else.
 */
function getElementBias(block) {

  var bias = TAG_NAME_BIASES[block.localName];

  if(isFinite(bias)) {
    //console.log('Element bias is %s', bias);
    return bias;
  } else {
    console.log('Non finite element bias for %s', block.localName);
    return 0;
  }

  // For now, we are just going with the block's own name. In the future 
  // we can consider the parent of the block, or the names of its inline 
  // elements, which is why I am leaving those biases in TAG_NAME_BIASES
  //return TAG_NAME_BIASES[block.localName] || 0;
}

var TAG_NAME_BIASES = {
  a:-1,
  address:-3,
  article:30,
  blockquote:3,
  body:0,
  dd:-3,
  div:20,
  dt:-3,
  footer:-200,
  font:0,
  form: -3,
  header: -5,
  h1: -5,
  h2: -5,
  h3: -5,
  h4: -5,
  h5: -5,
  h6: -5,
  li: -20,
  nav: -300,
  ol:-3,
  p:10,
  pre:3,
  section:50,
  td:3,
  th:-3,
  ul:-3
};

function getAttributeBias(block) {
  // This needs improvement but for now just look at the 
  // attributes of the block element itself. In the future we can 
  // look at containing element attributes and nested element attributes.
  var bias = 0;
  var vals = ((block.rawId || '') + ' ' + 
    (block.rawClass || '')).trim();
  if(vals.length) {
    if(/article|body|content|entry|main|post|text|blog|story/i.test(vals)) {
      bias += 25;
    }

    if(/comment|mainNav|contact|foot|footer|footnote|promo|related|scroll|shoutbox|sidebar|sponsor|shopping|tags|tool|widget/i.test(vals)) {
      bias -= 25;
    }
  }

  return bias;
}

/**
 * Penalize blocks with the copyright symbol
 *
 * TODO: This could be generalized to getNonContentSymbolBias
 * and penalize based on the frequency of any symbols 
 * that are rarely used in content, like pipes and such.
 */
function getCopyrightBias(block) {
  var allChildText = block.textContent;
  // &copy; &169; ©
  var hasCopyrightSymbol = allChildText.indexOf('&copy;') != -1 || 
    allChildText.indexOf('&#169;') != -1 || 
    allChildText.indexOf('©') != -1;
  return hasCopyrightSymbol ? -20 : 1;
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
var BAD_TAG_SELECTOR = 'select,option,input,applet,head,form,script,iframe,noscript,object,embed,frame,frameset,style';

function preprocessDocument(doc) {
  // Strip out some tags here while in development. The plan is to figure out the 
  // coupling with the sanitizer later but its completely independent now so we 
  // need to do this.
  util.each(doc.querySelectorAll(BAD_TAG_SELECTOR), removeElement);
  
  // Strip attributes of tags
  //http://www.nczonline.net/blog/2010/09/28/why-is-getelementsbytagname-faster-that-queryselectorall/
  util.each(doc.getElementsByTagName('*'), filterAttributes);


  // Replace rules with paragraphs
  
  util.each(doc.querySelectorAll('hr,br'), function(node) {
    // This is causing bugs and nullifying doc.body somehow
    //node.parentNode.insertBefore(doc.createElement('p'), node);
    //node.parentNode.remove(node);

    // TODO: first off I should have always been using this. Second
    // this needs to be tested now.
    node.parentNode.replaceChild(doc.createElement('p'),node);
  });


  // Strip most empty elements (other than images)
  util.filter(doc.querySelectorAll('*'), isEmptyElement).forEach(removeElement);


  // Strip out hidden comment nodes
  // Larrgely just for development purposes while reviewing raw html
  var commentIt = doc.createNodeIterator(doc,NodeFilter.SHOW_COMMENT);
  var comment = null;
  while(comment = commentIt.nextNode()) {
    comment.parentNode.removeChild(comment);
  }

}

/**
 * Clean up the attributes for a node.
 */
function filterAttributes(node) {

  // node.attributes is a live list, so we create a static
  // list then iteratively remove its items.
  var removableAttributes = [];
  util.filter(node.attributes, isNotRetainableAttribute).forEach(
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
    //node.setAttribute('rawid', rawId);
    node.rawId = rawId;
    node.removeAttribute('id');
  }

  var rawClass = node.getAttribute('class');
  if(rawClass) {
    node.rawClass = rawClass;
    //node.setAttribute('rawclass', rawClass);
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

var reIsNonToken = /&nbsp;|[^A-Za-z0-9@\-_]+/g;
//var reIsNonToken = /[\s\b\|]+|&nbsp;/g;
function tokenize(str) {
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

function exposeScoreAttribute(block) {
  if(isFinite(block.contentScore)) {
    block.setAttribute('score', block.contentScore.toFixed(2));
  } else {
    console.warn('non finite contentScore when setting score attribute');
    console.dir(block);
  }
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

// Export public API methods
return {
  transform: transformDocument
};

}(this));