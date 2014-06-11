// Copyright 2014 Josh Froelich. See LICENSE for details.

// TODO: take advantage of when image dimensions are present
// as attributes or within the style tag. these are not the 
// actual, which we cannot know till the image is downloaded,
// which we cannot know yet because the input HTMLDocument has 
// never touched the live DOM. But it the dims are hardcoded
// we can consider them as visual clues. look at 1x1 imgs.
// look at blocks consisting solely of images that are icon-like.
// look at blocks consisting of text + large images. etc.

// Similar to tag density heuristic, small reward for multiple
// h1/h2/etc tags as children?


// TODO: i need to reward images better. fails hard when content
// is just a few large images and some caption-like text.

// note: current impl has common failure pattern, somewhere near the title area



var calamine = (function(exports) {
'use strict';

/**
 * Apply calamine to an HTMLDocument object.
 */
function transformDocument(doc) {

  preprocessDocument(doc);
  
  var nodes = generateNodes(doc);
  var blocks = mapNodesToBlocks(nodes);
  var segments = mapBlocksToSegments(blocks);

  scoreSegments(segments);

  segments.forEach(function(s) {
    s.setAttribute('score', s.score);
    //s.style.border = '1px dotted #cccccc';
    //console.log('%s %s',s.localName, s.score);
  });

  // Score segments
  var body = findBody(doc, segments);
  
  if(body.body) {
    body.body.style.border = '2px solid green';
  } else {
    body.style.border = '2px solid green';
  }


  //doc.body.innerHTML = body.innerHTML;
  postprocessDocument(doc);

  return body.body ? body.body : body;
}

// This is not meant to be complete, see sanitizer for more complete list.
var BAD_TAG_SELECTOR = 'button,select,option,input,applet,head,form,script,iframe,noscript,object,embed,frame,frameset,style';

/**
 * Strip out some unwanted stuff. Split up BR and HR.
 */
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

  // TODO: strip out all elements with inline styles
  // where visibility is hidden.

  // TODO: strip out all elements with coloring information
  // where the foreground color is the same as the background
  // color?
}

var NODE_ITERATOR_TYPE = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT;
function nodeIteratorFilter(node) {
  if(node.nodeType == Node.ELEMENT_NODE) {
    if(node.localName == 'img') {
      return NodeFilter.FILTER_ACCEPT;
    } else {
      return NodeFilter.FILTER_REJECT;
    }
  } else if(node.nodeType == Node.TEXT_NODE) {
    return NodeFilter.FILTER_ACCEPT;
  }

  return NodeFilter.FILTER_REJECT;
}

/**
 * Maps an HTMLDocument to a list of image elements
 * and non-empty text nodes.
 */
function generateNodes(doc) {
  var nodes = [];
  var iterator = doc.createNodeIterator(doc.body, NODE_ITERATOR_TYPE, nodeIteratorFilter);
  var node = null;

  while(node = iterator.nextNode()) {
    if(node.nodeType == Node.ELEMENT_NODE) {
      nodes.push(node);
    } else if(node.nodeValue.trim().length) {
      // Make sure we ignore empty text nodes, successive
      // code relies on non-emptiness.

      nodes.push(node);
    }
  }

  return nodes;
}

/**
 * Merge nodes into block-level elements.
 */
function mapNodesToBlocks(nodes) {
  var blockIdCounter = 0;
  var blocks = [];
  nodes.forEach(function(node) {
    
    var block = findBlockAncestor(node);
    
    if(!isFinite(block.blockId)) {
      block.blockId = blockIdCounter++;

      if(node.nodeType == Node.ELEMENT_NODE) {
        block.containsImage = 1;
      } else {
        block.containsImage = 0;
      }

      // Only store the block the first time we see it.
      blocks.push(block);
    }

    // Store cardinality (a count of all descendents)
    // here so we can get the count quickly when agglomerating
    // so that we can later quickly calculate tag density.
    block.cardinality = block.cardinality ? block.cardinality + 1 : 1;

    // Immediately extract and annotate textual features 
    // to avoid having to walk the nodes of each block.

    // There are no text features for image nodes
    // NOTE: for <a><img></a>, should image count as 1 word or 
    // something to that effect?
    if(node.nodeType == Node.ELEMENT_NODE) {
      return;
    }

    // Extract features of text nodes
    var tokens = tokenize(node.nodeValue);
    if(!tokens.length) return;

    // Get the sum of the lengths of each token. We use this measure instead of 
    // nodeValue.length in order to ignore non-word chars
    var charCount = countTokenChars(tokens);

    // Add or update the total number of words in the block
    block.wordCount = block.wordCount || 0;
    block.wordCount += tokens.length;

    // Add or update the total number of characters (from words) in the block
    block.charCount = block.charCount || 0;
    block.charCount += charCount;

    // Add or update the total number of words inside anchors in the block
    if(pathContainsAnchor(node, block)) {
      block.anchorWordCount = block.anchorWordCount || 0;
      block.anchorWordCount += tokens.length;
    }
  });

  return blocks;
}

/**
 * Return true if an anchor is anywhere between the node and the block.
 * Anchors are inline elements. When assigning nodes to blocks, anchor
 * elements are skipped over. Therefore, when determing the number of 
 * words in anchor text for a block from the position of a text node,
 * we need to walk the path back up to the containing block element. It is 
 * not good enough to just check the parent node.
 * NOTE: this isn't the best performance considering we are repeating the 
 * same walk as findAncestorBlock. findAncestorBlock could achieve this
 * by checking for anchors along the way and storing a hidden property
 * in the block object.
 */
function pathContainsAnchor(node, block) {
  var parent = node.parentNode;
  while(parent != block && !isAnchor(parent)) {
    parent = parent.parentNode;
  }
  return isAnchor(parent);
}

/**
 * A helper function for mapping nodes to blocks. Searches for 
 * the first ancestral element that is a blocking element. Inline
 * elements are non-blocking. For example, in <p><a>text</a></p>, 
 * p is the closest block ancestor of text. a is inline so it is
 * essentially skipped. If a blocking element is not found, then
 * document.body is returned. We assume document.body is defined.
 */
function findBlockAncestor(node) {
  var root = node.ownerDocument.body;
  var parent = node.parentNode;
  while(parent != root && isInlineElement(parent)) {
    parent = parent.parentNode;
  }
  return parent;
}

/**
 * Group blocks into closest semantic ancestor. For example, group an LI block 
 * into its containing OL or UL. This can also be understood as simply merging
 * certain blocks into super blocks. While mapping, accumulate the features of 
 * each block into each segment. 
 */
function mapBlocksToSegments(blocks) {
  var segments = [];
  var segmentIdCounter = 0;
  blocks.forEach(function(block) {

    var segment = findSegmentAncestor(block);

    if(!isFinite(segment.segmentId)) {
      segment.segmentId = segmentIdCounter++;
      segments.push(segment);
    }

    // Note: if we did not find a parent segment
    // then block becomes segment. but i am pretty 
    // sure we are still not double counting metrics here 
    // because no two blocks without a segment can become the same
    // segment because blocks do not contain each other.

    segment.cardinality = segment.cardinality || 0;
    segment.cardinality += block.cardinality || 0;

    segment.charCount = segment.charCount || 0;
    segment.charCount += block.charCount || 0;

    segment.wordCount = segment.wordCount || 0;
    segment.wordCount += block.wordCount || 0;

    segment.anchorWordCount = segment.anchorWordCount || 0;
    segment.anchorWordCount += block.anchorWordCount || 0;

  });
  return segments;
}

function findSegmentAncestor(node) {
  var root = node.ownerDocument.body;
  var parent = node.parentNode;

  if(parent === root.parentNode) {
    return root;
  }

  if(isListItem(node)) {
    if(parent.localName == 'ol' || parent.localName == 'ul') {
      return parent;
    }

    return node;
  }

  if(node.localName == 'dt' || node.localName == 'dd') {
    if(parent.localName == 'dl') {
      return parent;
    }

    return node;
  }

  if(isMergeableBlockElement(node)) {
    while(parent != root && isMergeableBlockElement(parent)) {
      parent = parent.parentNode;
    }

    return parent;
  }


  if(isDivider(parent) && parent.childElementCount == 1) {
    // EXPERIMENTAL

    // The idea behind this merging is that content authors 
    // frequently use a 'container' element to format content 
    // such as silly CSS div tricks. This leads to cases 
    // like <outerdiv><innerdiv>content</innerdiv></outerdiv>. 
    // The goal is to promote the content out farther, higher 
    // in the hierarchy, because it has a depth that is more 
    // likely just formatting.

    // On the other hand, this negates much of what tag name
    // bias does. Yet on the other hand, tag name bias 
    // could be designed to work of the path from root to segment.

    // Note: this shold not just be div, it works for other 
    // container elements like section, nav, footer, header, 
    // and article.

    // At the same time, the other elements carry clearer semantics
    // assuming proper use. But div really is ambiguous. It is 
    // pre HTML5.


    // Skip over divs with 1 child element
    // Note: this is only 1 level so far, it could be multiple
    // Note: what about the text nodes in the parent? We didnt
    // prune empty texts (e.g. \r\n nodes) so there are frequently
    // leading and trailing text nodes. but it is not clear if they 
    // are text. But checking them yet again seems bad.
    // Also, not clear if we should be doing this.



    return parent;
  }

  // Default to self, the block is also the segment
  return node;
}

var MERGEABLE_BLOCK_ELEMENT = {
  blockquote:1,h1:1,h2:1,h3:1,h4:1,h5:1,h6:1,img:1,label:1,p:1,pre:1,time:1
};

function isMergeableBlockElement(node) {
  if(MERGEABLE_BLOCK_ELEMENT[node.localName]) {
    return true;
  } else {
    return false;
  }
}

/**
 * Note: for calculating distance between segments
 * we could use the number of nodes it would talk to 
 * walk up the tree to the closest common ancestor
 * and then back down the tree to the other segment
 * as distance metric. Maybe pre-calculating 
 * some kind of depth metric (# nodes from body) would 
 * help. Element depth itself could possibly be an indicator
 * of content vs boilerplate. Although that is sort of already
 * reflected in the aggregate cardinality feature.
 */

function scoreSegments(segments) {
  segments.forEach(function(segment) {
    segment.score = segment.score || 0;
    segment.score += getAnchorDensityBias(segment);
    segment.score += getTextDensityBias(segment);
    segment.score += getCopyrightBias(segment);
    segment.score += getElementDensityBias(segment);
    segment.score += getPositionBias(segment, segments.length);
    segment.score += getElementBias(segment);
    segment.score += getAttributeBias(segment);
  });

  segments.forEach(applySiblingBias);
}

function postprocessDocument(doc) {

  // TODO: move strip attributes from preprocess to postprocses

  //util.each(doc.querySelectorAll('div,span'), unwrapElement);
  //util.each(doc.querySelectorAll('span'), unwrapElement);
}

function findBody(doc, segments) {

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
    return node.score ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
  });

  while(element = iterator.nextNode()) {

    // TODO: one very simple improvement is to avoid any paths
    // that have negative scores. For each element, get its 
    // parents. Get those parents with scores. If any parent
    // has a negative score, skip the element. Note, this is 
    // simplistic and could backfire.

    if(element.score > maxScore) {
      maxScore = element.score;
      maxElement = element;
    }
  }

  if(!maxElement) {
    console.log('No max element, falling back to doc');
    maxElement = doc;
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
        copy.score = node.score || 0;
        if(copy.score) {
          copy.setAttribute('score', copy.score);
        }
        div.appendChild(copy);
      });
      div.score = maxElement.score || 0;
      div.setAttribute('score', maxElement.score);
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

  // assert block.score

  var sibling = block.previousElementSibling;
  if(sibling) {
    if(!sibling.score) {
      //console.log('setting undefined sibling score to 0');
      sibling.score = 0;
    }

    sibling.score += 0.2 * block.score;
    sibling = sibling.previousElementSibling;
    if(sibling) {
      if(!sibling.score) {
        //console.log('setting undefined sibling sibling score to 0');
        sibling.score = 0;
      }
      sibling.score += 0.1 * block.score;
    }
  }
  sibling = block.nextElementSibling;
  if(sibling) {
    if(!sibling.score) {
      sibling.score = 0;
    }
    sibling.score += 0.2 * block.score;
    sibling = sibling.nextElementSibling;
    if(sibling) {
      if(!sibling.score) {
        sibling.score = 0;
      }
      sibling.score += 0.1 * block.score;
    }
  }

  if(!isFinite(block.score)) {
    console.log('applySiblingBias somehow set score to !isFinite');
  }
}

/**
 * Anchor density is the ratio of the number of tokens within anchors to the number
 * of tokens within the block. Generally, blocks with density lower than 0.35
 * are content.
 *
 * Award points for low anchor density.
 */
function getAnchorDensityBias(element) {
  // Check for wordCount for 2 reasons: avoid divide by 0,
  // and sort fo avoid if its a segment consisting of an image.
  if(element.wordCount) {

    var ratio = (element.anchorWordCount || 0) / element.wordCount;

    // The threshold of 0.35 is based on results
    // demonstrated in the paper on using shallow features.
    if(ratio > 0.35) {
      // Penalize high link density
      return -10 * ratio;
    } else {
      // Proportionally reward low link density
      return 10 - 10 * ratio;
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
function getElementDensityBias(element) {
  // TODO: at the current moment this barely differentiates

  if(element.charCount) {
    return 10 - 10 * element.cardinality / element.charCount;
  } else {
    return -element.cardinality;
  }
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
function getTextDensityBias(element) {
  

  // This is basically element density, well, what I wanted element
  // density to be. Still not quite right though. It is not respecting
  // text length enough.

  //http://www.mercurynews.com/crime-courts/ci_25935432/l-judge-strikes-down-californias-laws-teacher-tenure
  // is a perfect example of the problem. It picks up the LI but not the container. Why did 
  // it not entirely propagate to the container? 
  // TODO: its an LI without an OL/UL. It is its own segment (but we dont iterate over own 
    // segs when finding body)

  /*if(element.cardinality) {
    return element.charCount / element.cardinality;
  } else {
    return 0;
  }*/

  // This worked
  return element.wordCount;
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
function getPositionBias(segment, blockCount) {

  var bias = 0;
  var index = segment.segmentId || 0;

  // Up to 2 points for closest offset to block start
  bias += 2 - 2 * index / blockCount;

  // Up to 2 points for smallest distance from middle
  // in either direction
  var mid = blockCount / 2;
  bias += 2 - 2 * Math.abs(index - mid) / mid;
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
  button:-20,
  dd:-3,
  div:20,
  dl:-100,
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
  li: -100,
  nav: -300,
  ol:-100,
  p:10,
  pre:3,
  section:50,
  td:3,
  time:0,
  tr:1,
  th:-3,
  ul:-100
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
 *
 * TODO: this does not seem to be working right now.
 */
function getCopyrightBias(block) {
  //var text = block.textContent;
  //return /&(copy|#169);/.test(text) || text.indexOf('©') != -1 ? -10 : 1;
  return 0;
}


function isNodeFilterAcceptTextNode(node) {
  var value = node.nodeValue.trim();
  return value.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
}



var INLINE_ELEMENT = {
  a:1,abbr:1,acronym:1,b:1,bdo:1,big:1,caption:1,center:1,cite:1,code:1,dfn:1,
  em:1,figcaption:1,font:1,kbd:1,i:1,math:1,q:1,samp:1,small:1,span:1,strike:1,
  strong:1,sub:1,sup:1,tt:1,u:1,'var':1
};

function isInlineElement(element) {
  return INLINE_ELEMENT[element.localName];
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

function countTokenChars(arrayOfStrings) {
  return arrayOfStrings.reduce(addStringLengthToSum, 0);
}

function addStringLengthToSum(sum, str) {
  return sum + str.length;
}

function isAnchor(node) {
  return node.localName === 'a';
}

function isDivider(node) {
  return node.localName === 'div';
}

function isListItem(node) {
  return node.localName === 'li';
}

function isBlockquote(node) {
  return node.localName === 'blockquote';
}

function isParagraph(node) {
  return node.localName === 'p';
}

function exposeScoreAttribute(block) {
  if(isFinite(block.score)) {
    block.setAttribute('score', block.score.toFixed(2));
  } else {
    console.warn('non finite score when setting score attribute');
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