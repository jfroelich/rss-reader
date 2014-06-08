
// Testing
//http://techcrunch.com/2014/06/07/wales-on-right-to-be-forgotten/

// TODO: if we are tracking anchor count and total word count 
// then there is no need to track non-anchor word count because 
// we can derive it simply by subtracing anchor word count from 
// total word count.

// TODO: rather than an array of objects, we could use a 2D array.
// And then, rather than a 2D array, we could use a single array of longs
// mapping each column into a successive offset, and moving over the array
// in block size where block size is n fields per block. This is premature 
// optimization so return to it later.

// TODO: do we even need to store block.name? I think it depends on how 
// we use the blocks, which I have not thought about yet. It pertains to 
// construction of the new document. We also will need to include images
// and possibly other non-text nodes. Maybe it is better to store 
// temporary references to the actual DOM nodes for reconstruction purposes.
// If that is the case then block.name is definitely useless.

var calamine = {};

// Iterate over nodes and create blocks. This works from the bottom 
// up, aggregating text nodes together based on whether the nodes are 
// contained within blocking elements.
calamine.generateBlocks = function(htmlDocument) {

  var elementIterator = htmlDocument.createNodeIterator(htmlDocument.body, NodeFilter.SHOW_TEXT);
  var node = elementIterator.nextNode();
  var blocks = [];
  var index = 0;
  var currentParent = null;
  var value = null;

  if(node) {
    value = node.nodeValue.trim();
    var block = {};
    block.id = index++;
    block.name = node.parentNode.localName;
    currentParent = node.parentNode;
    var wordCount = this.countWords(value);
    block.totalWordCount = wordCount;
    if(util.isAnchor(node.parentNode)) {
      block.anchorCount = 1;
      block.anchorWordCount = wordCount;
      block.nonAnchorWordCount = 0;
    } else {
      block.anchorCount = 0;
      block.anchorWordCount = 0;
      block.nonAnchorWordCount = wordCount;
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
      var prevBlock = blocks[index - 1];
      wordCount = this.countWords(value);
      prevBlock.charCount += value.length;
      prevBlock.totalWordCount += wordCount;
      if(util.isAnchor(node.parentNode)) {
        prevBlock.anchorCount++;
        prevBlock.anchorWordCount += wordCount;
      } else {
        prevBlock.nonAnchorWordCount += wordCount;
      }

      continue;
    }

    // Ignore valueless nodes.    
    if(!value) continue;

    // Shift our reference to the current parent
    currentParent = parent;

    var block = {};
    block.id = index++;
    block.name = parent.localName;
    block.charCount = value.length;
    wordCount = this.countWords(value);
    if(util.isAnchor(node.parentNode)) {
      block.anchorCount = 1;
      block.anchorWordCount = wordCount;
      block.nonAnchorWordCount = 0;
      block.totalWordCount = wordCount;
    } else {
      block.anchorCount = 0;
      block.anchorWordCount = 0;
      block.nonAnchorWordCount = wordCount;
      block.totalWordCount = wordCount;
    }

    blocks.push(block);
  }

  return blocks;
};

// Generate a score on a scale of 0 to 100, 100 being content and 0 being boilerplate,
// for each block. Store score as a new 'score' property of each block. This is a 
// second pass over the blocks because its easier to calculate stuff here now that 
// we have aggregate values, rather than trying to adjust ratios on the first pass.
calamine.scoreBlocks = function(blocks) {
  blocks.forEach(function(block) {
    
    // Assume all blocks with more than 10 words are not boilerplate.
    if(block.totalWordCount > 10) {
      block.score = 100;
      return;
    }
    
    // Calculate link density. Link density is the ratio of the number of 
    // tokens within an anchor to the number of tokens within the block.
    var linkDensity = (block.anchorWordCount / block.totalWordCount).toFixed(2);

    // Calculate text density. Split the text into lines. Text density is the 
    // ratio of word count to number of lines.
    var charsPerLine = 60;
    var numLines = (block.charCount / charsPerLine).toFixed(0);
    if(numLines < 1) numLines = 1;
    var textDensity = (block.totalWordCount / numLines).toFixed(2);
    
    // Bias by offset from 0 (using block.id as distance metric). Blocks closer to the 
    // middle are more likely to be content than boilerplate. We want a coefficient that 
    // increases the score the closer the block is to the middle. A larger coefficient 
    // increases the score.
    //var mid = (blocks.length / 2).toFixed(0);
    //var numBlocksFromMid = Math.abs(block.id - mid);
    //var distanceCoefficient = (numBlocksFromMid / blocks.length).toFixed(0);
    
    
    
    
  });
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
  };
  
  req.open('GET', url);
  req.responseType = 'document';
  req.send();
};
