
// Testing
//http://techcrunch.com/2014/06/07/wales-on-right-to-be-forgotten/

// TODO: expand testing to other docs

// TODO: remove charCount and instead when scoring sum up the lengths of the values
// NOTE: still wrong. sum of the lengths of individual WORDS.

// TODO: integrate some of readability's concepts regarding
// awards/penalties for class names, text value.
// e.g. if h1-h7 then add a tag type bias as these are generally content tags
// e.g. if p then add a tag type bias as these are generally content tags.
// e.g. if div class='advertisement' then penalize.

// TODO: add support for image blocks. change iterator to also include 
// image blocks (use a filter). when iterating just create a separate 
// type of block. adjust the block processing later to handle image 
// blocks differently.

// TODO: group LI blocks into UL/OL blocks.
// TODO: consider grouping DD blocks.

// TODO: rather than an array of objects, we could use a 2D array.
// And then, rather than a 2D array, we could use a single array of longs
// mapping each column into a successive offset, and moving over the array
// in block size where block size is n fields per block. This is premature 
// optimization so return to it later.




/*
BUG: last line of body not included as desired. end detection for body 
is somehow wrong.
http://techcrunch.com/2014/06/07/wales-on-right-to-be-forgotten/
*/

var calamine = {};

calamine.generateBlocks = function(htmlDocument) {
  var elementIterator = htmlDocument.createNodeIterator(htmlDocument.body, NodeFilter.SHOW_TEXT);
  var node, blocks = [], currentParent, value;

  if(node = elementIterator.nextNode()) {
    value = node.nodeValue.trim();
    currentParent = node.parentNode;
    this.appendBlock(blocks, currentParent, node,value);
  }

  while(node = elementIterator.nextNode()) {
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

  return blocks;
};

calamine.adjustBlock = function(block, node, value) {
  var wordCount = this.countWords(value);
  block.charCount += value.length;
  block.wordCount += wordCount;
  block.anchorWordCount += util.isAnchor(node.parentNode) ? wordCount : 0;
  block.parentNodes.push(node.parentNode);
  block.values.push(value);
};

calamine.appendBlock = function(blocks, blockParent, node, value) {  
  var wordCount = this.countWords(value);
  blocks.push({
    block: blockParent,
    charCount: value.length,
    wordCount: wordCount,
    anchorWordCount: util.isAnchor(node.parentNode) ? wordCount : 0,
    parentNodes: [node.parentNode],
    values: [value]
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

    // Bias by offset from 0 (using block.id as distance metric). Blocks closer to the 
    // middle are more likely to be content than boilerplate. We want a coefficient that 
    // increases the score the closer the block is to the middle. A larger coefficient 
    // increases the score. The lower the offset, the better the score. This is rather 
    // naive so only 5 points.
    var mid = blocks.length / 2;
    block.score += 5 - 5 * Math.abs(index - mid) / mid;

    // We want to bias the score based on neighboring blocks. 
    // NOTE: most blocks are evaluated twice, up to 10 points
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

  // Group adjacent 50+ blocks into the same group. Track 
  // blocks per group.
  var groups = {};
  for(var i = 0, group = 0, len = blocks.length;i < len; i++) {
    var block = blocks[i];
    if(block.score > 50) {
      if(!i) {
        block.group = 1;
        groups[block.group] = {index:block.group,start:i,end:i,count:1};
      } else if(blocks[i - 1].group) {
        block.group = blocks[i - 1].group;
        groups[block.group].end = i;
        groups[block.group].count++;
      } else {
        block.group = ++group;
        groups[block.group] = {index:block.group,start:i,end:i,count:1};
      }
    } else {
      block.group = 0;
    }
  }

  groups = util.values(groups).sort(function(a,b) {
    return a.start > b.start ? 1 : -1;
  });
  
  // Fix index property after possible reshuffling. 
  // This also starts the index from 0.
  for(var i = 0, len = groups.length; i < len; i++) {
    groups[i].index = i;
  }
  
  var largestGroup = groups.reduce(function(prev,curr) {
    return prev.count > curr.count ? prev : curr;
  }, groups[0]);

  // We found the bounds of largest group. Walk back from 
  // the start of the group.
  var blockStartIndex = largestGroup.start,
      groupStartIndex = largestGroup.index,
      blockEndIndex = largestGroup.end,
      groupEndIndex = largestGroup.index;
  
  while(--groupStartIndex) {
    if(blockStartIndex - groups[groupStartIndex].end < 3) {
      blockStartIndex = groups[groupStartIndex].start;
    } else {
      //groupStartIndex++;
      break;
    }
  }

  while(++groupEndIndex < groups.length) {
    if(groups[groupEndIndex].start - blockEndIndex < 3) {
      blockEndIndex = groups[groupEndIndex].end;
    } else {
      //groupEndIndex--;
      break;
    }
  }
  
  return {start: blockStartIndex, end: blockEndIndex};
};

calamine.countWords = function(str) {
  if(str) {
    var matches = str.match(/[\w\.\-@]+/g);
    return matches ? matches.length : 0;
  }
  return 0;
};

calamine.findParent = function(node, root) {
  var parent = node.parentNode;
  while(parent !== root && this.isInlineElement(parent)) {
    parent = parent.parentNode;
  }
  return parent;
};


/*
Problematic case:
<p><strong>content<br></strong><br><strong></strong><strong></strong><strong>content</strong>content</p>

We fixed the bug where we were not breaking, but now every element trailing the break is 
pushed into the next block. We want those to remain in the same block. Which means we 
cannot say they follow a break. Which means we only want to actually break in the case 
where its trailing content-less inlines but not inlines with content.

*/

calamine.followsBreak = function(node) {
  
  /*if(node.previousElementSibling) {
    
    var n = node.previousElementSibling;
    while(this.isInlineElement(n)) {
      n = n.previousElementSibling;
    }
    
    if(n && n.localName == 'br') {
      if(n != node.previousElementSibling) {
        //console.log('CASE 1: follows inline that follow break');
        //console.log('1: %s', node.nodeValue);
        // This case is problematic. I don't think we actually want to 
        // break here. (we dont want to return 1 here)
      } else {
        // So far in testing this case has not been observed.
        //console.log('CASE 2: immediately follows break');
        console.log('2: %s', node.nodeValue);
      }
      return 1;
    }

    return;
  }*/
  
  var n = node.parentNode.previousElementSibling;
  while(this.isInlineElement(n)) {
    n = n.previousElementSibling;
  }

  if(n && n.localName == 'br') {
    // These two cases work as expected
    if(n != node.parentNode.previousElementSibling) {
      //console.log('3: %s', node.nodeValue);
    } else {
      //console.log('4: %s', node.nodeValue);
    }
    return 1;
  }


/*  return (node.previousElementSibling && node.previousElementSibling.localName == 'br') || 
    (calamine.isInlineElement(node.parentNode) && node.parentNode.previousElementSibling && 
    node.parentNode.previousElementSibling.localName == 'br');*/
};

calamine.INLINE_ELEMENT = {
  a:1,abbr:1,acronym:1,b:1,bdo:1,big:1,cite:1,code:1,dfn:1,
  em:1,kbd:1,i:1,q:1,samp:1,small:1,span:1,strong:1,sub:1,
  sup:1,tt:1,'var':1
};

calamine.isInlineElement = function(node) {
  return node && node.nodeType == Node.ELEMENT_NODE && this.INLINE_ELEMENT[node.localName];
};