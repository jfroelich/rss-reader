
// Testing
//http://techcrunch.com/2014/06/07/wales-on-right-to-be-forgotten/


// TODO: integrate some of readability's concepts regarding
// awards/penalties for class names, text value.

// TODO: add support for image blocks. change iterator to also include 
// image blocks (use a filter). when iterating just create a separate 
// type of block. adjust the block processing later to handle image 
// blocks differently.

// TODO: stop tracking block.anchorCount?

// TODO: rather than an array of objects, we could use a 2D array.
// And then, rather than a 2D array, we could use a single array of longs
// mapping each column into a successive offset, and moving over the array
// in block size where block size is n fields per block. This is premature 
// optimization so return to it later.

// TODO: do we need to store block.name? I think it depends on how 
// we use the blocks, which I have not thought about yet. It pertains to 
// construction of the new document. We also will need to include images
// and possibly other non-text nodes. Maybe it is better to store 
// temporary references to the actual DOM nodes for reconstruction purposes.
// If that is the case then block.name is definitely useless.

// TODO: using value.length is not the proper measure of block length. We 
// want the sum of the lengths of words excluding non word characters because 
// non-word characters bias the metric.

var calamine = {};

// Iterate over nodes and create blocks. This works from the bottom 
// up, aggregating text nodes together based on whether the nodes are 
// contained within blocking elements.
calamine.generateBlocks = function(htmlDocument) {

  var elementIterator = htmlDocument.createNodeIterator(htmlDocument.body, NodeFilter.SHOW_TEXT);
  var node = elementIterator.nextNode();
  var blocks = [];
  var currentParent = null;
  var value = null;

  if(node) {
    value = node.nodeValue.trim();
    var block = {};
    block.name = node.parentNode.localName;
    currentParent = node.parentNode;
    var wordCount = this.countWords(value);
    
    block.totalWordCount = wordCount;
    if(util.isAnchor(node.parentNode)) {
      block.anchorCount = 1;
      block.anchorWordCount = wordCount;
    } else {
      block.anchorCount = 0;
      block.anchorWordCount = 0;
    }

    block.charCount = value.length;
    blocks.push(block);
  }

  while(node = elementIterator.nextNode()) {
    value = node.nodeValue.trim();
    
    // Search node ancestors for the closest blocking parent. Skip
    // inline elements as they are non-blocking.
    var parent = calamine.findParent(node, htmlDocument.body);

    if(!calamine.followsBreak(node) && parent == currentParent && value) {
      // In this case, this is a node that is not following a 
      // break node and this node's containing block is the same 
      // as the prior text node's containing block, and has a 
      // non-empty value. Therefore, merge this text node into 
      // the prior block (the currentParent).
      // We know we have a previous block because of the one iteration call
      // that occurred prior to iterating here.

      var prevBlock = blocks[blocks.length - 1];
      wordCount = this.countWords(value);
      prevBlock.charCount += value.length;
      prevBlock.totalWordCount += wordCount;
      if(util.isAnchor(node.parentNode)) {
        prevBlock.anchorCount++;
        prevBlock.anchorWordCount += wordCount;
      }

      continue;
    }

    // Ignore valueless nodes.
    if(!value) continue;

    // Shift our reference to the current parent
    currentParent = parent;

    var block = {};
    block.name = parent.localName;
    block.charCount = value.length;
    wordCount = this.countWords(value);
    if(util.isAnchor(node.parentNode)) {
      block.anchorCount = 1;
      block.anchorWordCount = wordCount;
      block.totalWordCount = wordCount;
    } else {
      block.anchorCount = 0;
      block.anchorWordCount = 0;
      block.totalWordCount = wordCount;
    }

    blocks.push(block);
  }

  return blocks;
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
    
    // Assume all blocks with more than 6 words are not boilerplate.
    if(block.totalWordCount > 6) {
      block.score = 90;
      continue;
    }

    // Calculate link density. Link density is the ratio of the number of 
    // tokens within an anchor to the number of tokens within the block.
    // The greater the link density, the higher chance of boilerplate, and the 
    // lower chance of content. Since we are scoring on 0 to 100, we want to 
    // increase the score if link density is lower.
    if(block.totalWordCount) {
      block.score += 30 - 30 * block.anchorWordCount / block.totalWordCount;
    }

    // Calculate text density. Split the text into lines. Text density is the 
    // ratio of word count to number of lines. The higher the density, the more likely 
    // the block is content and not boilerplate.
    var numLines = block.charCount / 60;
    if(numLines < 1) numLines = 1;
    var textDensity = block.totalWordCount / numLines;

    // The good content scores are generally about 7 to 10.5 or higher. Award 40 
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

calamine.findBodyContent = function(scoredBlocks) {
  // We want to find the largest sequence of high scoring 
  // blocks, and possibly extend it a bit in both directions
  // and use that. By extend, I mean we can skip over a few low scoring 
  // blocks in either direction if we see a juicy block a bit farther out.
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
  while(parent != root && calamine.isInlineElement(parent)) {
    parent = parent.parentNode;
  }
  return parent;
};

calamine.followsBreak = function(node) {
  return (node.previousElementSibling && node.previousElementSibling.localName == 'br') || 
    (calamine.isInlineElement(node.parentNode) && node.parentNode.previousElementSibling && 
    node.parentNode.previousElementSibling.localName == 'br');
};

calamine.INLINE_ELEMENT = {
  a:1,abbr:1,acronym:1,b:1,bdo:1,big:1,cite:1,code:1,dfn:1,
  em:1,kbd:1,i:1,q:1,samp:1,small:1,span:1,strong:1,sub:1,
  sup:1,tt:1,'var':1
};

calamine.isInlineElement = function(node) {
  return calamine.INLINE_ELEMENT[node.localName];
};

calamine.test = function(url) {
  var req = new XMLHttpRequest();
  req.onerror = function(err) {
    console.log(err);  
  };
  req.onload = function(event) {
    
    var removes = this.responseXML.querySelectorAll('script, iframe, object, embed, frame');
    util.each(removes, function(element) {
      if(element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    
    var blocks = calamine.generateBlocks(this.responseXML);
    //console.log('Found %s blocks', blocks.length);
    //blocks.forEach(function(block) {
    //  console.log('%s %s', block.name, block.totalWordCount);
    //});
    
    calamine.scoreBlocks(blocks);
    
    blocks.forEach(function(block) {
      console.log('%s:%s', block.name, block.score);
    });
    

  };
  
  req.open('GET', url);
  req.responseType = 'document';
  req.send();
};
