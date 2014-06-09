/**
 * Copyright 2014 Josh Froelich. Licensed under the MIT license.
 *
 * Based partly on the following:
 *
 *  Christian Kohlschütter, Peter Fankhauser, and Wolfgang Nejdl. 2010. 
 *  Boilerplate detection using shallow text features. In Proceedings of the
 *  third ACM international conference on Web search and data mining (WSDM '10). 
 *  ACM, New York, NY, USA, 441-450. DOI=10.1145/1718487.1718542
 */

var calamine = {};

calamine.generateBlocks = function(htmlDocument) {
  var it = this.createNodeIterator(htmlDocument);
  var node, blocks = [], currentParent, value;

  if(node = it.nextNode()) {
    currentParent = node.parentNode;
    if(node.nodeType == Node.TEXT_NODE) {
      value = node.nodeValue.trim();
      blocks.push(this.createTextBlock(currentParent, node, value));
    } else {
      blocks.push(this.createImageBlock(currentParent,node));
    }
  }

  while(node = it.nextNode()) {
    if(node.nodeType == Node.ELEMENT_NODE) {
      blocks.push(this.createImageBlock(currentParent, node));
      continue;
    }

    value = node.nodeValue;
    var parent = this.findParent(node, htmlDocument.body);
    if(parent == currentParent && !this.followsBreak(node)) {
        this.mergeIntoBlock(blocks[blocks.length - 1], node, value);
    } else {
      blocks.push(this.createTextBlock(parent, node, value));
      currentParent = parent;
    }
  }

  // Score each block
  var blockCount = blocks.length, block, index = 0;
  for(;index < blockCount; index++) {
    block = blocks[index];
    if(block.image) continue;// ignore images (for now)
    block.score += this.getLinkDensityBias(block);
    block.score += this.getTextDensityBias(block);
    block.score += this.getPositionBias(block, index, blockCount);
    block.score += this.getTagNamesBias(block);
    block.score += this.getAttributeBias(block);

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
};

calamine.createNodeIterator = function(doc) {
  return doc.createNodeIterator(doc.body, 
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, 
    this.nodeIteratorFilter);  
};

calamine.nodeIteratorFilter = function(node) {
  if(node.nodeType == Node.TEXT_NODE) {
    var value = node.nodeValue ? node.nodeValue.trim() : undefined;
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
};

calamine.mergeIntoBlock = function(block, node, value) {
  var words = this.parseWords(value);
  block.charCount += this.aggregateLength(words);
  block.wordCount += words.length;
  block.anchorWordCount += util.isAnchor(node.parentNode) ? words.length : 0;
  block.parentNodes.push(node.parentElement);
  block.values.push(value);
};

calamine.createTextBlock = function(blockParent, node, value) {  
  var words = this.parseWords(value);
  return {
    block: blockParent,
    charCount: this.aggregateLength(words),
    wordCount: words.length,
    anchorWordCount: util.isAnchor(node.parentNode) ? words.length : 0,
    parentNodes: [node.parentElement],
    values: [value],
    score: 0
  };
};

calamine.createImageBlock = function(blockParent, node) {
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
};

calamine.getLinkDensityBias = function(block) {
  // Link density is the ratio of the number of tokens within anchors to the number 
  // of tokens within the block. Generally, blocks with density lower than 0.35
  // are content.
  return block.wordCount ? 30 - 30 * block.anchorWordCount / block.wordCount : 0;
};

calamine.getTextDensityBias = function(block) {
  // Text density is the ratio of word count to line count. Content blocks
  // have higher text densities than boilerplate. According to the research,
  // densities higher than 10.5, or higher than 7 but with link density lower
  // than 0.35, are probably content.
  var lineCount = block.charCount > 60 ? block.charCount / 60 : 1;
  var textDensity = block.wordCount / lineCount;
  // 40 points for highest density.
  return 4 * (textDensity > 10 ? 10 : textDensity);
};

calamine.getPositionBias = function(block, index, numBlocks) {
  var bias = 0;
  // Blocks closer to the middle are more likely to be content than boilerplate
  var mid = numBlocks / 2;
  bias += 5 - 5 * Math.abs(index - mid) / mid;

  // Blocks closer to the start are more likely to be content.
  bias += 5 - 5 * index / numBlocks;
  return bias;
};

calamine.getTagNamesBias = function(block) {
  return block.parentNodes.map(this.getElementName).reduce(this.sumTagNameBias.bind(this),0);
};

calamine.TAG_NAME_BIASES = {
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

calamine.sumTagNameBias = function(bias, name) {
  return bias + (this.TAG_NAME_BIASES[name] || 0);
};

calamine.getAttributeBias = function(block) {

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
};


calamine.findExtendedBodyBounds = function(blocks) {

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

    // Not in use.
    //g.averageBlockScore = g.totalScore / g.blocks.length;
  });
  
  // Prefer sum over average to favor blocks of text over headlines
  
  var bestGroup = groups.reduce(function(prev, curr) {
    return prev.totalScore > curr.totalScore ? prev : curr;
  }, groups[0]);

  // TODO: The extend method should consider hierachical 
  // position, not simply block index distance. Maybe what we 
  // want is agglomerative clustering. 
  // See http://en.wikipedia.org/wiki/Hierarchical_clustering

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
};


calamine.parseWords = function(str) {
  if(str) {
    var matches = str.match(/[\w\.\-@]+/g);
    if(matches)
      return matches;
  }
  return [''];
};

calamine.aggregateLength = function(arrayOfStrings) {
  return arrayOfStrings.reduce(function(prev,curr) {
    return prev + curr.length;
  }, 0);
};

calamine.findParent = function(node, root) {
  var parent = node.parentNode;
  while(parent != root && this.isInlineElement(parent)) {
    parent = parent.parentNode;
  }
  
  // Further aggregation of list items. Note: 
  // For <ul><li><a>Hello</a>world</li></ul>, both 
  // Hello and world are in the UL block. Hello appears
  // under parent node a, not li. world appears under li.
  if(parent.localName == 'li') {
    var list = parent.parentNode;    
    while(list != root && list.localName != 'ol' && list.localName != 'ul') {
      list = list.parentNode;
    }

    if(list.localName == 'ol' || list.localName == 'ul') {
      return list;
    }
  } else if(parent.localName = 'dt' || parent.localName == 'dd') {
    var list = parent.parentNode;
    while(list != root && list.localName != 'dl') {
      list = list.parentNode;
    }
    if(list.localName == 'dl') {
      return list;
    }
  } else if(parent.localName == 'td') {
    // TODO: Group TDs into TRs. We avoid full 
    // table block scope because I anticipate this causes some documents 
    // to all appear in the same block. Since we are really after vertically 
    // delineated blocks, it makes more sense to use rows as the block scope.
    // The block aggregating function that occurs after scoring can consider
    // merging content TRs into TDs.
  }

  return parent;
};

calamine.followsBreak = function(node) {
  // Use parent node not text node, and use previousElementSibling
  // not previousSibling
  var n = node.parentNode.previousElementSibling;
  // Find the first non-inline preceding element in the same 
  // block.
  while(this.isInlineElement(n)) {
    n = n.previousElementSibling;
  }
  // Return true if there was a non-inline preceding element and 
  // it was a break rule.
  return n && n.localName == 'br';
};

calamine.INLINE_ELEMENT = {
  a:1,abbr:1,acronym:1,b:1,bdo:1,big:1,cite:1,code:1,dfn:1,
  em:1,kbd:1,i:1,q:1,samp:1,small:1,span:1,strong:1,sub:1,
  sup:1,tt:1,'var':1
};

calamine.getElementName = function(node) {
  return node.localName;
};

calamine.isInlineElement = function(node) {
  return node && node.nodeType == Node.ELEMENT_NODE && this.INLINE_ELEMENT[node.localName];
};