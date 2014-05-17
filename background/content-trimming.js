(function(exports) {
'use strict';

// Trim leading and trailing content from a document
function trimDocument(doc) {
    
  if(!doc) {
    console.log('could not trim undefined document');
    return;
  }
  
  // Trim leading
  var node = doc.body.firstChild, sibling;
  while(node && isTrimmableNode(node)) {
    sibling = node.nextSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }
  
  // Trim trailing
  node = doc.body.lastChild;
  while(node && isTrimmableNode(node)) {
    sibling = node.previousSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }
}

// Returns true if the node is trimmable
function isTrimmableNode(node) {
  if(node.nodeType == Node.COMMENT_NODE) {
    return true;
  } else if(node.nodeType == Node.ELEMENT_NODE && node.nodeName == 'BR') {
    return true;
  } else if(node.nodeType == Node.TEXT_NODE) {
    node.textContent = node.textContent.trim();
    if(node.textContent.length == 0) {
      return true;
    }
  } else if(node.nodeType == Node.ELEMENT_NODE && node.nodeName == 'P') {
    // This works for several cases. For it to be really accurate we would have
    // to something like a DFS that trims while backtracking over a set of allowed
    // child tags. Those situations are probably more rare and it is for only a small
    // benefit so this is probably sufficient.
    
    if(node.childNodes.length == 0) {
      // <p></p>
      return true;
    } else if(node.childNodes.length == 1 && node.firstChild.nodeType == Node.TEXT_NODE && 
      node.firstChild.textContent.trim().length == 0) {
      // <p>whitespace</p>
      return true;
    }
  }
}

exports.trimDocument = trimDocument;


})(this);