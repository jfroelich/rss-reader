// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// This is under heavy construction and is really just an experiment.
// The idea is to improve the processing done in dom-filter and
// calamine. Rather than apply changes to an actual document object, we are
// going to create our own very simple non-native document object,
// with limited functionality, and then manipulate it,
// to see if it is faster to do all the manipulations on the virtual document
// TODO: create vprune.js and make calls
// TODO: support other node types (e.g. comments)

function VNode() {
  'use strict';

  this.parentNode = null;
  this.firstChild = null;
  this.lastChild = null;

  this.nextSibling = null;
  this.previousSibling = null;

  this.name = null; // always lower case name (only for element nodes)
  this.type = null; // nodeType (e.g. Node.TEXT_NODE)
  this.value = null; // value (set for text nodes, not element nodes)
  this.attributes = null; // lazily-loaded Map<String, String> of attributes
}

VNode.createTextNode = function(value) {
  'use strict';
  const node = new VNode();
  node.type = Node.TEXT_NODE;
  node.value = value;
  return node;
};

VNode.createElement = function(name) {
  'use strict';
  const node = new VNode();
  node.type = Node.ELEMENT_NODE;
  node.name = name;
  return node;
};

// Returns whether this node is allowed to contain the childNode. This is
// currently extremely simple and not spec compliant.
// TODO: what about constraints like <script> cannot contain <any-element>?
// Current constraints:
// * A node cannot contain itself
// * Only element nodes can contain other nodes
VNode.prototype.mayContainChild = function(childNode) {
  'use strict';
  return this !== childNode && this.isElement();
};

// TODO: if appending a text node, can we immediately normalize?
VNode.prototype.appendChild = function(node) {
  'use strict';

  if(!this.mayContainChild(node))
    return false;

  // Attempting to append the last child again is a successful no-op
  if(this.lastChild === node)
    return true;

  // If the node was attached, detach it (keeping its child edges intact)
  // This also ensures that node.nextSibling is set to null.
  node.remove();

  // Create an edge relation between the parent and the appended node
  node.parentNode = this;

  // This always occurs, even if this.lastChild is undefined
  node.previousSibling = this.lastChild;

  if(this.lastChild) {
    // If this node has a last child prior to the append, then we know it
    // contains at least one other node. Link the previous lastChild to the
    // new node
    this.lastChild.nextSibling = node;
  } else {
    // No last child means implicitly means no firstChild either, which means
    // the appended node is now the first child
    this.firstChild = node;
  }

  // Regardless of whether the node contained nodes prior to the append,
  // the newly appended node is now the last child.
  this.lastChild = node;

  return true;
};

// TODO: what should be the behavior if either argument is undefined?
VNode.prototype.replaceChild = function(newChild, oldChild) {
  'use strict';

  // Replacing a child with itself is a succesful no-op. We have to explicitly
  // do this check here to avoid the default behavior of insertBefore which
  // considers this a failure.
  // TODO: actually, I think insertBefore considers this a success, so this
  // check is not needed?
  if(newChild === oldChild) {
    return true;
  }

  return this.insertBefore(newChild, oldChild) && oldChild.remove();
};

VNode.prototype.insertBefore = function(node, referenceNode) {
  'use strict';

  if(!referenceNode)
    return this.appendChild(node);
  if(!this.mayContainChild(node))
    return false;
  if(referenceNode.parentNode !== this)
    return false;

  // TODO: should this actually return true? Is it a no-op success?
  if(referenceNode.previousSibling === node)
    return false;

  // TODO: is this actually a failure? What does it mean to try and insert
  // a node before itself?
  if(node === referenceNode)
    return true;

  // Remove the node from its old tree (but keep the node's children intact)
  node.remove();

  node.parentNode = referenceNode.parentNode;
  node.nextSibling = referenceNode;
  const oldPreviousSibling = referenceNode.previousSibling;
  if(oldPreviousSibling) {
    oldPreviousSibling.nextSibling = node;
    node.previousSibling = oldPreviousSibling;
  } else {
    referenceNode.parentNode.firstChild = node;
  }
  referenceNode.previousSibling = node;
  return true;
};

// NOTE: this leaves the node's edges to its children intact
// (this.firstChild && this.lastChild are unchanged). It breaks the edges
// to the parent and siblings.
// TODO: why is this boolean? it never can return false
VNode.prototype.remove = function() {
  'use strict';
  const parentNode = this.parentNode;

  // If there is no parent, it is a successful no-op, not a failure
  if(!parentNode) {
    return true;
  }

  const nextSibling = this.nextSibling;
  const previousSibling = this.previousSibling;

  this.parentNode = null;
  this.nextSibling = null;
  this.previousSibling = null;

  if(nextSibling) {
    nextSibling.previousSibling = previousSibling;
    if(previousSibling) {
      previousSibling.nextSibling = nextSibling;
    } else {
      parentNode.firstChild = nextSibling;
    }
  } else if(previousSibling) {
    previousSibling.nextSibling = null;
    parentNode.lastChild = previousSibling;
  } else {
    parentNode.firstChild = null;
    parentNode.lastChild = null;
  }

  return true;
};

// Returns the closest ancestor node matching the predicate, excluding the
// node itself (unlike the spec). Returns null if no ancestors matched.
VNode.prototype.closest = function(predicate) {
  'use strict';
  let node = this.parentNode;
  let result = null;
  while(!result && node) {
    if(predicate(node)) {
      result = node;
    } else {
      node = node.parentNode;
    }
  }
  return result;
};

VNode.prototype.isText = function() {
  'use strict';
  return this.type === Node.TEXT_NODE;
};

VNode.prototype.isElement = function() {
  'use strict';
  return this.type === Node.ELEMENT_NODE;
};

Object.defineProperty(VNode.prototype, 'parentElement', {
  get: function() {
    'use strict';
    return this.closest(function(node) {
      return node.isElement();
    });
  }
});

Object.defineProperty(VNode.prototype, 'firstElementChild', {
  get: function() {
    'use strict';
    let result = null;
    for(let node = this.firstChild; !result && node; node = node.nextSibling) {
      if(node.isElement()) {
        result = node;
      }
    }
    return result;
  }
});

Object.defineProperty(VNode.prototype, 'lastElementChild', {
  get: function() {
    'use strict';
    let result = null;
    for(let node = this.lastChild; !result && node;
      node = node.previousSibling) {
      if(node.isElement()) {
        result = node;
      }
    }
    return result;
  }
});

Object.defineProperty(VNode.prototype, 'childElementCount', {
  get: function() {
    'use strict';
    let count = 0;
    for(let node = this.firstChild; node; node = node.nextSibling) {
      if(node.isElement()) {
        count++;
      }
    }
    return count;
  }
});

Object.defineProperty(VNode.prototype, 'childNodes', {
  get: function() {
    'use strict';
    const childNodes = [];
    for(let node = this.firstChild; node; node = node.nextSibling) {
      childNodes.push(node);
    }
    return childNodes;
  }
});

// Returns the node that is at the root of this node's tree
Object.defineProperty(VNode.prototype, 'root', {
  get: function() {
    'use strict';
    let node = this;
    while(node.parentNode) {
      node = node.parentNode;
    }
    return node;
  }
});

Object.defineProperty(VNode.prototype, 'id', {
  get: function() {
    'use strict';
    return this.getAttribute('id');
  }
});

VNode.prototype.getAttribute = function(name) {
  'use strict';
  if(this.attributes) {
    return this.attributes.get(name);
  }
};

VNode.prototype.setAttribute = function(name, value) {
  'use strict';

  if(!this.isElement()) {
    return;
  }

  if(!this.attributes) {
    this.attributes = new Map();
  }

  // Force some magical minor cleaning of the value as a convenience
  let storedValue = VNode._isString(value) ? value :
    (value ? String(value) : '');
  storedValue = storedValue.trim();
  this.attributes.set(name, storedValue);
};

VNode.prototype.hasAttribute = function(name) {
  'use strict';
  return this.getAttribute(name);
};

VNode.prototype.removeAttribute = function(name) {
  'use strict';
  if(this.isElement() && this.attributes) {
    this.attributes.delete(name);
    if(!this.attributes.size) {
      this.attributes = null;
    }
  }
};

// Pre-order DFS traversal
// @param includeSelf {boolean} whether to include the current node in the
// traversal
// TODO: less repetitive code?
VNode.prototype.traverse = function(callback, includeSelf) {
  'use strict';

  const stack = [];
  let node = null;
  if(includeSelf) {
    stack.push(this);
  } else {
    node = this.lastChild;
    while(node) {
      stack.push(node);
      node = node.previousSibling;
    }
  }

  while(stack.length) {
    node = stack.pop();
    callback(node);
    node = node.lastChild;
    while(node) {
      stack.push(node);
      node = node.previousSibling;
    }
  }
};

// Searches all descendants, self included, for the first node to match
// the given predicate function, and returns the first match or null.
// Kind of like querySelector, but no need for intermediate string
// representation
// I've chosen to re-implement the stack based DFS pre-order traversal
// approach here, because of the short circuiting logic that does not
// belong in the other method.
// TODO: exclude the node itself? or should i start from
// this.firstChild above? If I start above I have to also
// visit siblings
// TODO: does querySelector include the current node?
VNode.prototype.search = function(predicate) {
  'use strict';

  const stack = [this];
  let node = null;
  let found = false;
  let match = null;
  while(!match && stack.length) {
    node = stack.pop();

    // if(node !== this && predicate(node)) {

    if(predicate(node)) {
      match = node;
    } else {
      node = node.lastChild;
      while(node) {
        stack.push(node);
        node = node.previousSibling;
      }
    }
  }
  return match;
};

// Removes empty text nodes from the set of descendants, self excluded
// Merges adjacent text nodes from the set of descendants, self excluded
// TODO: if converting to DOM takes care of this, deprecate
// TODO: if perf is poor, inline traversal or write a mutation-allowing iterator
VNode.prototype.normalize = function() {
  'use strict';

  // Build a static list of all text nodes, excluding the current node
  let nodes = [];
  this.traverse(function(node) {
    if(node.isText()) {
      nodes.push(node);
    }
  }, false);

  // Get only empty text nodes, then remove them
  nodes.filter(function(node) {
    return node.value === null || node.value === void 0;
  }).forEach(function(node) {
    node.remove();
  });

  // Regenerate a static collection of text nodes
  nodes = [];
  this.traverse(function(node) {
    if(node.isText()) {
      nodes.push(node);
    }
  }, false);

  // Merge each follower with its predecessor. Due to how traverse is
  // implemented, we know that previousSibling will always be visited prior
  // to visiting the current node in the iteration.
  nodes.forEach(function(node) {
    const prev = node.previousSibling;
    if(prev && prev.isText()) {
      prev.value = prev.value + node.value;
      node.remove();
    }
  });
};


// Returns a static array of matching descendant nodes. Departs from the spec.
// Not very performant.
// TODO: does getElementsByTagName include the current node?
VNode.prototype.getElementsByName = function(name, includeSelf) {
  'use strict';
  const elements = [];
  this.traverse(function(node) {
    if(node.name === name) {
      elements.push(node);
    }
  }, includeSelf);
  return elements;
};

// Not optimized what-so-ever. Limited to descendants of the node, including
// self.
VNode.prototype.getElementById = function(id) {
  'use strict';
  if(VNode._isString(id)) {
    return this.search(function(node) {
      return id === node.id;
    });
  }
};

// Rather than calling getElementById, which traverses each time, consider
// calling this once on a tree and then using a map lookup to get an element
// by its id. The map includes the id of the root element (if it has one).
VNode.generateIdMap = function(tree) {
  'use strict';
  const ids = new Map();
  tree.traverse(function(node) {
    if(node.isElement()) {
      const id = node.getAttribute('id');
      if(VNode._isString(id)) {
        ids.set(id, node);
      }
    }
  }, true);
  return ids;
};


VNode.prototype.isTable = function() {
  'use strict';
  return this.name === 'table';
}

VNode.prototype.isTableRow = function() {
  'use strict';
  return this.name === 'tr';
};

VNode.prototype.isTableSection = function() {
  'use strict';
  const name = this.name;
  return name === 'thead' || name === 'tbody' || name === 'tfoot';
};

// NOTE: the current implementation is rather strict and does not account
// for things like intermediate wrapping elements within a table element
Object.defineProperty(VNode.prototype, 'rows', {
  get: function() {
    'use strict';

    // This property should only be defined on table elements
    if(!this.isTable()) {
      return;
    }

    const rows = [];
    for(let node = this.firstChild; node; node = node.nextSibling) {
      if(node.isTableRow()) {
        rows.push(node);
      } else if(node.isTableSection()) {
        for(let subNode = node.firstChild; subNode;
          subNode = subNode.nextSibling) {
          if(subNode.isTableRow()) {
            rows.push(subNode);
          }
        }
      }
    }
    return rows;
  }
});

VNode.prototype.isTableCell = function() {
  return this.name === 'td';
};

Object.defineProperty(VNode.prototype, 'cols', {
  get: function() {
    'use strict';
    // This property should only be defined on HTMLTRElements
    if(!this.isTableRow()) {
      return;
    }
    const columns = [];
    for(let node = this.firstChild; node; node = node.nextSibling) {
      if(node.isTableCell()) {
        columns.push(node);
      }
    }
    return columns;
  }
});

// TODO: convert into a DOMNode and then toString that
VNode.prototype.toString = function() {
  'use strict';

  if(this.isText()) {
    return '"' + this.value + '"';
  } else {
    let buffer = new Array();
    buffer.push('<');
    buffer.push(this.name);
    const attributes = this.attributes || [];
    for(let entry of attributes) {
      buffer.push(' ');
      buffer.push(entry[0]);
      buffer.push('="');
      buffer.push(entry[1]);
      buffer.push('"');
    }
    buffer.push('/>');
    return buffer.join('');
  }
};


// Generates a VNode representation of a DOM node. Does not do any linking to
// other vnodes (you have to append). Does not inspect
// more deeply and bring in dom child nodes. Returns undefined
// if cannot create the node (e.g. tried to import a comment).
VNode.fromDOMNode = function(node) {
  'use strict';

  const vNode = new VNode();

  if(node.nodeType === Node.ELEMENT_NODE) {

    // TODO: data mapped properties not present as attributes?

    vNode.type = node.nodeType;
    vNode.name = node.localName;

    const attributes = node.attributes;
    const numAttributes = attributes.length;
    for(let i = 0, attribute, attributeName; i < numAttributes; i++) {
      attribute = attributes[i];
      attributeName = attribute.name;
      vNode.setAttribute(attributeName, node.getAttribute(attributeName));
    }

    if(node.width && !vNode.hasAttribute('width')) {
      vNode.setAttribute('width', String(node.width));
    }

    if(node.height && !vNode.hasAttribute('height')) {
      vNode.setAttribute('height', String(node.height));
    }

  } else if(node.nodeType === Node.TEXT_NODE) {
    vNode.type = node.nodeType;
    vNode.value = node.nodeValue;
  } else {
    console.debug('Unsupported node type: ', node);
    return;
  }

  return vNode;
};

// NOTE: we create it within the local hosting document, I do not expect
// it to be a problem to append such a node to another document. I suppose
// maybe there is a problem if Chrome does eager fetching?
VNode.toDOMNode = function(vNode) {
  'use strict';
  let node = null;

  if(vNode.type === Node.TEXT_NODE) {
    node = document.createTextNode(vNode.value);
  } else if(vNode.type === Node.ELEMENT_NODE) {
    node = document.createElement(vNode.name);
    for(let attribute of vNode.attributes || []) {
      node.setAttribute(attribute[0], attribute[1]);
    }
  } else {
    console.log('Unsupported type ', vNode.type);
  }

  return node;
};

// Create a vNode tree from an dom root node
VNode.fromHTMLDocument = function(document) {
  'use strict';

  const Pair = function(virtualParent, currentNode) {
    this.virtualParent = virtualParent;
    this.currentNode = currentNode;
  };

  if(!document ||
    document.nodeType !== Node.DOCUMENT_NODE ||
    !document.documentElement ||
    document.documentElement.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  let virtualRoot = null;

  const stack = new Array();
  stack.push(new Pair(null, document.documentElement));

  while(stack.length) {
    let pair = stack.pop();
    let parent = pair.virtualParent;
    let node = pair.currentNode;

    if(node.nodeType !== Node.ELEMENT_NODE &&
      node.nodeType !== Node.TEXT_NODE) {
      // console.debug('Skipping unsupported node', node);
      continue;
    }

    let virtualNode = VNode.fromDOMNode(node);
    if(parent) {
      parent.appendChild(virtualNode);
    } else {
      virtualRoot = virtualNode;
    }

    node = node.lastChild;
    while(node) {
      stack.push(new Pair(virtualNode, node));
      node = node.previousSibling;
    }
  }

  return virtualRoot;
};

// Creates an returns a new HTMLDocument instance from this VNode and its
// connected nodes. tree should be the root VNode of a VNode tree.
VNode.toHTMLDocument = function(tree) {
  'use strict';
  throw new Error('Not implemented');
};

// TODO: Treat the current node as document like. Create a dom starting this
// with node as the root, then call outerHTML on its root node.
Object.defineProperty(VNode.prototype, 'outerHTML', {
  get: function() {
    return 'not implemented';
  }
});

// See http://stackoverflow.com/questions/4059147
VNode._isString = function(value) {
  return Object.prototype.toString.call(value) === '[object String]';
};
