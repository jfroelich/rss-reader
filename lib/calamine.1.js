/**
 * Copyright 2014 Josh Froelich. Licensed under the MIT license.
 *
 * Based partly on the following:
 *
 *  Christian Kohlschütter, Peter Fankhauser, and Wolfgang Nejdl. 2010. 
 *  Boilerplate detection using shallow text features. In Proceedings of the
 *  third ACM international conference on Web search and data mining (WSDM '10). 
 *  ACM, New York, NY, USA, 441-450. DOI=10.1145/1718487.1718542
 *
 * Example usage: 
 *   var cleanDoc = calamine.transform(originalHTMLDocument);
 */

var calamine = (function(exports) {

function transformDocument(doc) {
  // TODO: implement me

  var blocks = generateBlocks(doc);
  var bounds = findExtendedBodyBounds(blocks);

  if(!bounds) {
    console.warn('no bounds?');
    bounds = {start:0, end: 0};
  }

  var outputDoc = document.implementation.createHTMLDocument();

  var inbounds = function(block) {
    return block.start >= bounds.start && block.end < bounds.end;
  }

  blocks.filter(inbounds).forEach(function(block) {

    if(block.image) {
      var image = outputDoc.createElement('img');
      image.setAttribute('src', block.image.getAttribute('src'));
      image.style.display = 'inline';
      image.style.float = 'left';
      image.style.padding = '10px';
      outputDoc.appendChild(image);
      return;
    }

    for(var b = 0; b < block.values.length;b++) {
      var parentNode = block.parentNodes[b];
      var value = block.values[b];

      if(parentNode.localName == 'blockquote') {
        var blockquote = outputDoc.createElement('blockquote');
        blockquote.innerHTML = value;
        outputDoc.appendChild(blockquote);
      } else if(parentNode.localName == 'a') {
        var anchor = outputDoc.createElement('a');
        anchor.setAttribute('href', parentNode.getAttribute('href'));
        anchor.innerHTML = value;
        outputDoc.appendChild(anchor);
      } else if(parentNode.localName == 'strong' || parentNode.localName == 'b') {
        var strong = outputDoc.createElement('strong');
        strong.innerHTML = value;
        outputDoc.appendChild(strong);
      } else if(parentNode.localName == 'p') {
        var p = outputDoc.createElement('p');
        p.innerHTML = value;
        outputDoc.appendChild(p);
      } else if(parentNode.localName == 'span') {
        var span = outputDoc.createElement('span');
        span.innerHTML = value;
        outputDoc.appendChild(span);
      } else if(parentNode.localName == 'h2' || parentNode.localName == 'h3' || 
          parentNode.localName == 'h4' || parentNode.localName == 'h5' || 
          parentNode.localName == 'h6') {
        var heading = outputDoc.createElement('h2');
        heading.innerHTML = value;
        outputDoc.appendChild(heading);
      } else {
        var unknown = document.createElement('p');
        unknown.style.color = 'red';
        outputDoc.appendChild(unknown);
      }
    }
  });

  return outputDoc;
}

/**
 * TODO: this represents a mapping from the DOM hierarchy to 
 * a list. We should recharactize this as if it were the func
 * parameter to Array.map. Basically name this something like 
 * mapNodesToBlocks.
 */
function generateBlocks(doc) {
  var it = createNodeIterator(doc);
  var node, blocks = [], currentParent, value;

  if(node = it.nextNode()) {
    currentParent = node.parentNode;
    if(node.nodeType == Node.TEXT_NODE) {
      value = node.nodeValue.trim();
      blocks.push(createTextBlock(currentParent, node, value));
    } else {
      blocks.push(createImageBlock(currentParent,node));
    }
  }

  while(node = it.nextNode()) {
    if(node.nodeType == Node.ELEMENT_NODE) {
      blocks.push(createImageBlock(currentParent, node));
      continue;
    }

    value = node.nodeValue;
    var parent = findParent(node, doc.body);
    if(parent == currentParent && !followsBreak(node)) {
        mergeIntoBlock(blocks[blocks.length - 1], node, value);
    } else {
      blocks.push(createTextBlock(parent, node, value));
      currentParent = parent;
    }
  }

  // Score each block
  var blockCount = blocks.length, block, index = 0;
  for(;index < blockCount; index++) {
    block = blocks[index];
    if(block.image) continue;// ignore images (for now)
    block.score += getLinkDensityBias(block);
    block.score += getTextDensityBias(block);
    block.score += getPositionBias(block, index, blockCount);
    block.score += getTagNamesBias(block);
    block.score += getAttributeBias(block);

    // We want to bias the score based on neighboring blocks. 
    // NOTE: most blocks are evaluated twice, up to 10 points
    // TODO: just promote content following content. If the previous block 
    // is content, promote both. It is that simple. No need to use 
    // ratios.
    if(index > 1) {
      var prevBlock = blocks[index - 1];
      var prevRatio = prevBlock.score / 100;
      var thisRatio = block.score / 100;
      prevBlock.score += 5 * thisRatio;
      block.score += 5 * prevRatio;
    }
  }

  return blocks;
}

function createNodeIterator(doc) {
  return doc.createNodeIterator(doc.body, 
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, 
    nodeIteratorFilter);  
}

function nodeIteratorFilter(node) {
  if(node.nodeType == Node.TEXT_NODE) {
    //var value = node.nodeValue ? node.nodeValue.trim() : undefined;
    if(node.nodeValue && node.nodeValue.trim()) {
      return NodeFilter.FILTER_ACCEPT;
    } else {
      return NodeFilter.FILTER_REJECT;
    }
  }

  if(node.nodeType == Node.ELEMENT_NODE) {
    if(node.localName == 'img') {
      return NodeFilter.FILTER_ACCEPT;
    }
  }

  return NodeFilter.FILTER_REJECT;
}

function mergeIntoBlock(block, node, value) {
  var words = parseWords(value);
  block.charCount += aggregateLength(words);
  block.wordCount += words.length;
  block.anchorWordCount += isAnchor(node.parentNode) ? words.length : 0;
  block.parentNodes.push(node.parentElement);
  block.values.push(value);
}

function createTextBlock(blockParent, node, value) {  
  var words = parseWords(value);
  return {
    block: blockParent,
    charCount: aggregateLength(words),
    wordCount: words.length,
    anchorWordCount: isAnchor(node.parentNode) ? words.length : 0,
    parentNodes: [node.parentElement],
    values: [value],
    score: 0
  };
}

function createImageBlock(blockParent, node) {
  return {
    image: node,
    block: blockParent,
    charCount: 0,
    wordCount: 0,
    anchorWordCount: 0,
    parentNodes : [blockParent],
    values : [],
    score: 0
  };
}

function getLinkDensityBias(block) {
  // Link density is the ratio of the number of tokens within anchors to the number 
  // of tokens within the block. Generally, blocks with density lower than 0.35
  // are content.
  return block.wordCount ? 30 - 30 * block.anchorWordCount / block.wordCount : 0;
}

function getTextDensityBias(block) {
  // Text density is the ratio of word count to line count. Content blocks
  // have higher text densities than boilerplate. According to the research,
  // densities higher than 10.5, or higher than 7 but with link density lower
  // than 0.35, are probably content.
  var lineCount = block.charCount > 60 ? block.charCount / 60 : 1;
  var textDensity = block.wordCount / lineCount;
  // 40 points for highest density.
  return 4 * (textDensity > 10 ? 10 : textDensity);
}

function getPositionBias(block, index, numBlocks) {
  var bias = 0;
  // Blocks closer to the middle are more likely to be content than boilerplate
  var mid = numBlocks / 2;
  bias += 5 - 5 * Math.abs(index - mid) / mid;

  // Blocks closer to the start are more likely to be content.
  bias += 5 - 5 * index / numBlocks;
  return bias;
}

function getTagNamesBias(block) {
  return block.parentNodes.map(getElementName).reduce(sumTagNameBias,0);
}

var TAG_NAME_BIASES = {
  address:-3,
  article:10,
  blockquote:3,
  dd:-3,
  div:5,
  dt:-3,
  form: -3,
  h1: -5,
  h2: -5,
  h3: -5,
  h4: -5,
  h6: -5,
  li: -3,
  ol:-3,
  p:10,
  pre:3,
  td:3,
  th:-3,
  ul:-3
};

function sumTagNameBias(bias, name) {
  return bias + (TAG_NAME_BIASES[name] || 0);
}

function getAttributeBias(block) {
  // Refactor. Use hash lookup instead of regex.
  var bias = 0;
  var vals = block.parentNodes.reduce(function(acc,curr) {
    return acc + ' ' + (curr.id || '') + ' ' + (curr.className || '');
  },'');
  if(/article|body|content|entry|main|post|text|blog|story/i.test(vals))
    bias += 25;
  if(/comment|mainNav|contact|foot|footer|footnote|promo|related|scroll|shoutbox|sidebar|sponsor|shopping|tags|tool|widget/i.test(vals))
    bias -= 25;
  return bias;
}

function findExtendedBodyBounds(blocks) {

  var groups = [];
  for(var blockIndex = 0, groupIndex = 0, len = blocks.length; 
    blockIndex < len; blockIndex++) {
    var block = blocks[blockIndex];
    if(block.score < 51) {
      block.group = -1;
      continue;
    }

    if(blockIndex && blocks[blockIndex - 1].group > -1) {
      block.group = blocks[blockIndex - 1].group;
      groups[groups.length-1].blocks.push(block);
    } else {
      block.group = groups.length;
      groups.push({index: groupIndex++,start: blockIndex, blocks:[block]});
    }
  }
  
  if(!groups.length) {
    console.warn('No groups found');
    return {start: 0, end: blocks.length - 1};
  }
  
  // Calculate total and average block score for each group
  groups.forEach(function(g) {
    g.totalScore = g.blocks.reduce(function(accumulator,currBlock) {
      return accumulator + currBlock.score;
    }, 0);
  });
  
  // Prefer sum over average to favor blocks of text over headlines
  var bestGroup = groups.reduce(function(prev, curr) {
    return prev.totalScore > curr.totalScore ? prev : curr;
  }, groups[0]);


  // Walk backward from the start of the best group
  var index = bestGroup.index, start = bestGroup.start;
  while(index--) {
    var end = groups[index].start + groups[index].blocks.length;
    if(start - end < 3) {
      start = groups[index].start;
    } else {
      break;
    }
  }

  // Walk forward from the end of the best group
  index = bestGroup.index;
  var end = bestGroup.start + bestGroup.blocks.length;
  while(index++ < groups.length) {
    if(groups[index].start - end < 3) {
      end = groups[index].start + groups[index].blocks.length;
    } else {
      break;
    }
  }

  return {start: start, end: end};
}

function parseWords(str) {
  if(str) {
    var matches = str.match(/[\w\.\-@]+/g);
    if(matches) return matches;
  }
  return [''];
}

function aggregateLength(arrayOfStrings) {
  return arrayOfStrings.reduce(addStringLengthToSum, 0);
}

function addStringLengthToSum(sum, str) {
  return sum + str.length;
}

/**
 * Finds the closest ancestor element that is not inline 
 * by walking up the parent path in the node hierarchy. 
 * If the walk reaches root then root is the parent.
 */
function findParent(node, root) {
  var parent = node.parentNode;
  while(parent != root && isInlineElement(parent)) {
    parent = parent.parentNode;
  }
  return parent;
}

function followsBreak(node) {
  // Use parent node not text node, and use previousElementSibling
  // not previousSibling
  var n = node.parentNode.previousElementSibling;
  // Find the first non-inline preceding element in the same 
  // block.
  while(isInlineElement(n)) {
    n = n.previousElementSibling;
  }
  // Return true if there was a non-inline preceding element and 
  // it was a break rule.
  return n && n.localName == 'br';
}

function isAnchor(node) {
  return node && node.localName == 'a';
}

function getElementName(node) {
  return node.localName;
}

var INLINE_ELEMENT = {
  a:1,abbr:1,acronym:1,b:1,bdo:1,big:1,cite:1,code:1,dfn:1,
  em:1,kbd:1,i:1,q:1,samp:1,small:1,span:1,strong:1,sub:1,
  sup:1,tt:1,'var':1
};

function isInlineElement(node) {
  return node && node.nodeType == Node.ELEMENT_NODE && INLINE_ELEMENT[node.localName];
}

// Export public methods
return {
  transform: transformDocument,

  // TEMP: allow test.js to use old API for a sec
  generateBlocks: generateBlocks,
  findExtendedBodyBounds: findExtendedBodyBounds
};

}(this));