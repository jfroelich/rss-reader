
// TODO: not sure if it goes here but I want to strip certain whitespace
// from the entire document, like line breaks outside of pre.

// TODO: if this can be refactored into rules it might be nice to do this
// a single pass over the document together with sanitizer/content filters
// instead of this secondary pass. And it would be even nicer if I had some 
// easy to code finite state machine-like approach.

var trimming = {};

// Removes leading and trailing whitespace nodes from an HTMLDocument
// The doc object itself is modified in place, no return value.
trimming.trimDocument = function(doc) {
  // if !doc || !doc.body this should just plainly fail, that is a code error

  // Note: we only traverse the first level of the DOM hiearchy 
  // (intentionally). This could lead to problems if we need more 
  // complex trimming criteria.

  // Trim leading
  var node = doc.body.firstChild, sibling;
  while(node && this.isTrimmableNode_(node)) {
    sibling = node.nextSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }
  
  // Trim trailing
  node = doc.body.lastChild;
  while(node && this.isTrimmableNode_(node)) {
    sibling = node.previousSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }
};

// Cache some properties (never perf tested)
// but I assume it is ok as this function gets called
// a considerable amount.
trimming.COMMENT_ = Node.COMMENT_NODE;
trimming.TEXT_ = Node.TEXT_NODE;
trimming.ELEMENT_ = Node.ELEMENT_NODE;



// Returns true if the node is trimmable, otherwise returns undefined
trimming.isTrimmableNode_ = function(node) {
  
  // Trim comments
  if(node.nodeType == this.COMMENT_) {
    return true;
  }
  
  // Trim empty text nodes.
  if(node.nodeType == this.TEXT_) {
    // NOTE: I don't like doing this but I also do not like 
    // re-trimming later.
    
    // WARNING: this actually affects the DOM state.
    node.textContent = node.textContent.trim();
    
    if(node.textContent.length == 0) {
      return true;
    }
  }
  
  // TODO: combine the element branches

  // Trim breaks
  if(node.nodeType == this.ELEMENT_ && node.nodeName == 'BR') {
    return true;
  }

  // Trim empty paragraphs.
  if(node.nodeType == this.ELEMENT_ && node.nodeName == 'P') {
    // This works for several cases. For it to be really accurate we would have
    // to something like a DFS that trims while backtracking over a set of allowed
    // child tags. Those situations are probably more rare and it is for only a small
    // benefit so this is probably sufficient.
    
    // TODO: consider &nbsp; and other whitespace entities. We are not at this 
    // point sanitizing those. <p>&nbsp;</p> is a thing.

    // Note: consider childElementCount instead of childNodes.length. Although it might 
    // be different here? Need to test the differences.
    
    if(node.childNodes.length == 0) {
      // <p></p>
      return true;
    } else if(node.childNodes.length == 1 && node.firstChild.nodeType == this.TEXT_ && 
      node.firstChild.textContent.trim().length == 0) {

      // <p>whitespace</p>
      return true;
    }
  }
};