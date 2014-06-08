
// Testing
//http://techcrunch.com/2014/06/07/wales-on-right-to-be-forgotten/

// TODO: if i am now storing values per block I do not need to 
// calc charCount and store it as a block property.


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

// TODO: do we need to store block.name? I think it depends on how 
// we use the blocks, which I have not thought about yet. It pertains to 
// construction of the new document. We also will need to include images
// and possibly other non-text nodes. Maybe it is better to store 
// temporary references to the actual DOM nodes for reconstruction purposes.
// If that is the case then block.name is definitely useless.

// TODO: using value.length is not the proper measure of block length. We 
// want the sum of the lengths of words excluding non word characters because 
// non-word characters bias the metric.


/*
BUG: Break detection fails if the text is a child of an inline element that is 
not the first inline element in the block or if the text follows an inline 
element.

Specifically, break is not found in these cases: 
STARTBLOCK
  BREAK ONE_OR_MORE_INLINE_ELEMENTS INLINE_ELEMENT_TEXT
ENDBLOCK
STARTBLOCK
  BREAK ONE_OR_MORE_INLINE_ELEMENTS START_BLOCK_TEXT
ENDBLOCK



Bugged out on the following text, merging the strong with content near the end into the prior
block. I think it is because I only check whether immediately follows break, not whether 
follows break or inline.

<p><strong>content?<br></strong><br><strong></strong><strong></strong><strong>content:</strong>&nbsp;content</p>
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
  return node.nodeType == Node.ELEMENT_NODE && this.INLINE_ELEMENT[node.localName];
};

calamine.test = function(url) {
  var req = new XMLHttpRequest();
  req.onerror = function(err) {console.error(err);};
  req.onload = function(event) {
    util.each(this.responseXML.querySelectorAll(
      'applet,script,iframe,object,embed,frame'), function(element) {
      if(element && element.parentNode) element.parentNode.removeChild(element);
    });

    var blocks = calamine.generateBlocks(this.responseXML);

    var bounds = calamine.findExtendedBodyBounds(blocks);
    if(!bounds) {
      console.log('no bounds');
      bounds = {start:0, end: blocks.length};
    }
    
    var oldContainer = document.getElementById('test');
    if(oldContainer) oldContainer.parentNode.removeChild(oldContainer);
    
    var testContainer = document.createElement('div');
    testContainer.setAttribute('id','test');
    document.body.appendChild(testContainer);
    
    for(var i = bounds.start; i < bounds.end;i++) {
      var block = blocks[i];
      var p = document.createElement('p');

      for(var b = 0; b < block.values.length;b++) {
        var parent = block.parentNodes[b];
        if(parent.localName == 'blockquote') {
          p.innerHTML += '<blockquote>' + block.values[b] + '</blockquote> ';
        } else if(parent.localName == 'a') {
          p.innerHTML += '<a href="">' + block.values[b] + '</a> ';
        } else if(parent.localName == 'strong') {
          p.innerHTML += '<strong>' + block.values[b] + '</strong> ';
        } else if(parent.localName == 'p') {
          p.innerHTML += block.values[b] + ' ';
        } else if(parent.localName == 'span') {
          p.innerHTML += '<span>' + block.values[b] + '<span> ';
        } else if(parent.localName == 'h4') {
          p.innerHTML += '<h4>' + block.values[b] + '</h4>';
        } else {
          p.innerHTML += '?: ' + block.values[b];
        } 
      }

      testContainer.appendChild(p);
    }
  };
  
  req.open('GET', url);
  req.responseType = 'document';
  req.send();
  return 'Applying lotion to ' + url;
};
