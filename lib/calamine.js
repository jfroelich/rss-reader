
// TODO: use mean block score to calculate group sore and use 
// max  instead of num blocks to find best group.
// TODO: promote content the closer it is to the start.

// TODO: expand testing to other docs
//http://techcrunch.com/2014/06/07/wales-on-right-to-be-forgotten/
//http://abcnews.go.com/US/social-climber-la-kings-back-goals/story?id=24045669

// TODO: integrate some of readability's concepts regarding
// awards/penalties for class names, text value.
// e.g. if h1-h7 then add a tag type bias as these are generally content tags
// e.g. if p then add a tag type bias as these are generally content tags.
// e.g. if div class='advertisement' then penalize.

// TODO: rather than an array of objects, we could use a 2D array.
// And then, rather than a 2D array, we could use a single array of longs
// mapping each column into a successive offset, and moving over the array
// in block size where block size is n fields per block. This is premature 
// optimization so return to it later.

var calamine = {};

calamine.generateBlocks = function(htmlDocument) {
  var it = this.createNodeIterator(htmlDocument);
  var node, blocks = [], currentParent, value;

  if(node = it.nextNode()) {
    currentParent = node.parentNode;
    if(node.nodeType == Node.TEXT_NODE) {
      value = node.nodeValue.trim();
      this.appendBlock(blocks, currentParent, node, value);      
    } else {
      // Image node.
      this.appendImageBlock(blocks, currentParent, node);
    }
  }

  while(node = it.nextNode()) {
    if(node.nodeType == Node.ELEMENT_NODE) {
      this.appendImageBlock(blocks, currentParent, node);
      continue;
    }

    value = node.nodeValue.trim();
    if(!value) continue;
    var parent = this.findParent(node, htmlDocument.body);
    if(parent === currentParent && !this.followsBreak(node)) {
      this.adjustBlock(blocks[blocks.length - 1], node, value);
    } else {
      this.appendBlock(blocks,parent, node, value);
      currentParent = parent;
    }
  }

  this.scoreBlocks(blocks);

  //blocks.forEach(function(b) {
  //  console.log('%s: %s %s', b.block.localName, b.score, b.values ? b.values.join('|') : '?');
  //});

  return blocks;
};

calamine.createNodeIterator = function(doc) {
  return doc.createNodeIterator(doc.body, 
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, 
    this.nodeIteratorFilter);  
};

calamine.nodeIteratorFilter = function(node) {
  if(node.nodeType == Node.TEXT_NODE) {
    // TODO: Test for length of trimmed value here?
    return NodeFilter.FILTER_ACCEPT;
  }
  if(node.nodeType == Node.ELEMENT_NODE) {
    if(node.localName == 'img') {
      return NodeFilter.FILTER_ACCEPT;
    }
  }

  return NodeFilter.FILTER_REJECT;
};


calamine.adjustBlock = function(block, node, value) {
  var words = this.parseWords(value);
  block.charCount += this.aggregateLength(words);
  block.wordCount += words.length;
  block.anchorWordCount += util.isAnchor(node.parentNode) ? words.length : 0;
  block.parentNodes.push(node.parentNode);
  block.values.push(value);
};

calamine.appendBlock = function(blocks, blockParent, node, value) {  
  var words = this.parseWords(value);
  blocks.push({
    block: blockParent,
    charCount: this.aggregateLength(words),
    wordCount: words.length,
    anchorWordCount: util.isAnchor(node.parentNode) ? words.length : 0,
    parentNodes: [node.parentNode],
    values: [value]
  });
};

calamine.appendImageBlock = function(blocks, blockParent, node) {
  blocks.push({
    block: blockParent,
    image: node
  });
};

// Generate a score on a scale of 0 to 100, 100 being content and 0 being boilerplate,
// for each block. Store score as a new 'score' property of each block. This is a 
// second pass over the blocks because its easier to calculate stuff here now that 
// we have aggregate values and know the number of blocks, rather than trying to 
// adjust ratios on the first pass.
calamine.scoreBlocks = function(blocks) {

  for(var block, index = 0; index < blocks.length; index++) {
    block = blocks[index];
    block.score = 0;

    if(block.image) {
      // For now, leave images with score 0. Including a score tends to cause 
      // boundary images to cause unwanted bounds extensions.
      continue;
    }

    // Calculate link density. Link density is the ratio of the number of 
    // tokens within an anchor to the number of tokens within the block.
    // The greater the link density, the higher chance of boilerplate, and the 
    // lower chance of content. Since we are scoring on 0 to 100, we want to 
    // increase the score if link density is lower. Generally, a weight 
    // lower than 0.35 is content.
    if(block.wordCount) {
      block.score += 30 - 30 * block.anchorWordCount / block.wordCount;
    }

    // Calculate text density. The ratio of word count to number of lines. The higher 
    // the density, the more likely the block is content and not boilerplate. Choosing 
    // 60 as arbitrary nchars per line.
    var textDensity = block.wordCount / (block.charCount > 60 ? block.charCount / 60 : 1);

    // Density higher than 10.5 is generally content. Density higher than 7 with a 
    // link density lower than 0.35 is generally content. Award 40 
    // points to anything over 10. Award a proportional amount for less.
    block.score += 4 * (textDensity > 10 ? 10 : textDensity);

    // Bias by offset from mid (using block.id as distance metric). Blocks closer to the 
    // middle are more likely to be content than boilerplate. We want a coefficient that 
    // increases the score the closer the block is to the middle. A larger coefficient 
    // increases the score. The lower the offset, the better the score. This is rather 
    // naive so only 5 points.
    var mid = blocks.length / 2;
    block.score += 5 - 5 * Math.abs(index - mid) / mid;

    // Bias score by offset from 0. Blocks closer to the start are more likely to be 
    // content than boilerplate. We want a coefficient that increases the score the 
    // closer the block is to the start. A larger coefficient increases the score. 
    // The lower the offset, the better the score. This is also rather naive, so only 
    // 10 points.
    block.score += 10 - 10 * index / blocks.length;


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
};

calamine.findExtendedBodyBounds = function(blocks) {
  
  // TODO: store an array of blocks per group. This is part of an attempt 
  // to easily calculate average score per group. Once I do that, note 
  // that I no longer need to store group.count. Also, I no longer need to 
  // store start or end.
  // Also, I am no longer sure why I am storing index as a group property when 
  // it is implicit through its position in the groups hash.
  // So we need to store object per index of groups, not just an array. So we 
  // store two properties: start (the index of the block at the start of the 
  // the group, and blocks, an array of blocks in the group). Count is derived 
  // from the length fo the blocks array.  End is derived from the start 
  // plus the count.
  var groups = [];
  for(var blockIndex = 0, groupIndex = 0, len = blocks.length; blockIndex < len; blockIndex++) {
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
      groups.push({start: blockIndex, blocks:[block]});
    }
  }
  
  console.dir(groups);

  // I think we need to track start because blocks dont have position so we 
  // cannot know where we are.
  

  return {start:0, end: 0};
};

/*
  // Group adjacent 50+ blocks into the same group. Track 
  // blocks per group.
  var groups = {};
  for(var i = 0, group = 0, len = blocks.length;i < len; i++) {
    var block = blocks[i];
    if(block.score > 50) {
      if(!i) {
        block.group = 1;
        groups[block.group] = {index:block.group,start:i,end:i+1,count:1};
      } else if(blocks[i - 1].group) {
        block.group = blocks[i - 1].group;
        groups[block.group].end = i + 1;
        groups[block.group].count++;
      } else {
        block.group = ++group;
        groups[block.group] = {index:block.group,start:i,end:i+1,count:1};
      }
    } else {
      block.group = 0;
    }
  }

  groups = util.values(groups).sort(function(a,b) {
    return a.start > b.start ? 1 : -1;
  });
  
  // Fix index property after possible shuffling and start from 0.
  for(var i = 0, len = groups.length; i < len; i++) {
    groups[i].index = i;
  }
  
  // The largest group metric is not always right. Instead try using 
  // something like mean block score and count together.
  //groups.forEach(function(group) {
  //  var sumScore = 
  //});
  
  // NOTE: the groups.length == 0 branch here is untested

  var largestGroup = groups.length ? groups.reduce(function(prev,curr) {
    return prev.count > curr.count ? prev : curr;
  }, groups[0]) : {index:0,start:0,end:blocks.length};

  var blockStartIndex = largestGroup.start,
      groupStartIndex = largestGroup.index,
      blockEndIndex = largestGroup.end,
      groupEndIndex = largestGroup.index;
  
  // Walk backward from the start of the largest group.
  while(--groupStartIndex) {
    if(blockStartIndex - groups[groupStartIndex].end < 3) {
      blockStartIndex = groups[groupStartIndex].start;
    } else {
      groupStartIndex++;
      break;
    }
  }
  
  // Walk forward from the end of the largest group.
  while(++groupEndIndex < groups.length) {
    if(groups[groupEndIndex].start - blockEndIndex < 3) {
      blockEndIndex = groups[groupEndIndex].end;
    } else {
      groupEndIndex--;
      break;
    }
  }

  return {start: blockStartIndex, end: blockEndIndex};
*/


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
  while(parent !== root && this.isInlineElement(parent)) {
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

calamine.isInlineElement = function(node) {
  return node && node.nodeType == Node.ELEMENT_NODE && this.INLINE_ELEMENT[node.localName];
};