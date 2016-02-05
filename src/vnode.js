// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// This is under heavy construction and is really just an experiment.
// The idea is to improve the processing done in dom-filter and
// calamine. Rather than apply changes to an actual document object, we are
// going to create our own very simple non-native document object,
// with limited functionality, and then manipulate it,
// to see if it is faster to do all the manipulations on the virtual document
// None of this has been tested and may be wayyyyyy off.
// TODO: use VDocument, VNode, and VDocumentUtils globals, or set util functions
// on the function objects or on the prototypes, remove the vd namespace

// TODO: actually, what if I just created a directed acyclical graph library,
// with a from-html and to-html utility method? Or just used one that exists?
// I basically don't need to any metaphors involving the DOM at all, I instead
// write code that analyzes this simple tree data structure, completely
// independent of the DOM.
// I don't need to be as abstract as a graph, or directed graph, or directed
// acyclical graph, I just need a tree.
// TODO: what I basically want is a tree data structure. We get some
// html, parse into a document, transform into a tree, manipulate the tree,
// and then transform back into a document and then back into an html string
// to append. the reading is done about the same as the manipulation, the
// creation is one. So the creation can be slow, but after that, the reading
// and changing should be fast. The final toHTMLDocument function can also be
// slow. So, what type of tree implementation would be ideal for this?
// I think it comes down to how I store children. If I used a linked list,
// then removing child nodes within the middle of the list is faster than
// dealing modifying an array. But if I use an array, moving sequentially over
// the children is faster, and jumping to a particular child is faster. But I
// think that the list feels more appropriate, because I don't think I need
// to jump to particular children. So I just need pointers between siblings,
// and a pointer to the first child (the head) so I know where to start.
// Every node needs a pointer to its parent, sure. A parent just needs a
// pointer to its first child. A child just needs a pointer to its next sibling
// and I suppose also its previous sibling to iterate over children in reverse.
// A node without a parent is the root node of a tree. Removing a node detaches
// the node from the tree, effectively creating a new tree from that removed
// node, because that removed node becomes the root of that other tree.
// Then I basically need to support appendChild, insertBefore, remove. Then
// for querying I need to come up with some ways to traverse the tree. I don't
// need a separate tree object, the caller just holds a reference to the root
// node.

// See https://github.com/WebKit/webkit/blob/master/Source/
// WebCore/dom/ContainerNode.cpp

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

// Returns whether this node is allowed to contain the childNode. This is
// currently extremely simple and not spec compliant.
VNode.prototype.mayContainChild = function(childNode) {
  'use strict';
  return this !== childNode && this.isElement();
};

VNode.prototype.appendChild = function(node) {
  'use strict';

  if(!this.mayContainChild(node))
    return false;
  if(this === node)
    return false;
  if(this.lastChild === node)
    return true;

  if(node.parentNode && node.parentNode !== this) {
    if(node === node.parentNode.firstChild) {
      node.parentNode.firstChild = node.nextSibling;
    }

    if(node === node.parentNode.lastChild) {
      node.parentNode.lastChild = node.previousSibling;
    }

    if(node.nextSibling) {
      node.nextSibling.previousSibling = node.previousSibling;
    }

    if(node.previousSibling) {
      node.previousSibling.nextSibling = node.nextSibling;
    }
  }

  node.parentNode = this;
  node.nextSibling = null;
  node.previousSibling = this.lastChild;

  if(this.lastChild) {
    this.lastChild.nextSibling = node;
  } else {
    this.firstChild = node;
  }

  this.lastChild = node;

  return true;
};

VNode.prototype.replaceChild = function(newChild, oldChild) {
  'use strict';

  if(newChild == oldChild) {
    return true;
  }

  if(this.insertBefore(newChild, oldChild)) {
    oldChild.remove();
    return true;
  }

  return false;
};

VNode.prototype.countChildNodes = function() {
  'use strict';
  let count = 0;
  for(let node = this.firstChild; node; node = node.nextSibling) {
    count++;
  }
  return count;
};

VNode.prototype.getChildAt = function(index) {
  'use strict';
  let result = null;
  for(let node = this.firstChild, i = 0; !result && node;
    node = node.nextSibling, i++) {
    if(i === index) {
      result = node;
    }
  }
  return result;
};

VNode.prototype.insertBefore = function(node, referenceNode) {
  'use strict';

  if(!referenceNode)
    return this.appendChild(node);
  if(!this.mayContainChild(node))
    return false;
  if(referenceNode.parentNode !== this)
    return false;
  if(referenceNode.previousSibling === node)
    return false;
  if(node === referenceNode)
    return true;

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

VNode.prototype.remove = function() {
  'use strict';
  const parentNode = this.parentNode;
  const nextSibling = this.nextSibling;
  const previousSibling = this.previousSibling;
  if(parentNode) {
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
  }

  return this;
};

VNode.prototype.isRoot = function() {
  return !this.parentNode;
};

VNode.prototype.isText = function() {
  'use strict';
  return this.type === Node.TEXT_NODE;
};

VNode.prototype.isElement = function() {
  'use strict';
  return this.type === Node.ELEMENT_NODE;
};

VNode.isTextNode = function(node) {
  'use strict';
  return node.isText();
};

VNode.isElementNode = function(node) {
  'use strict';
  return node.isElement();
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

// Returns the closest ancestor node matching the predicate, excluding the
// node itself. Returns null if no ancestors or no ancestors matched.
VNode.prototype.closest = function(predicate) {
  'use strict';
  let parent = this.parentNode;
  let result = null;
  while(!result && parent) {
    if(predicate(parent)) {
      result = parent;
    } else {
      parent = parent.parentNode;
    }
  }
  return result;
};

Object.defineProperty(VNode.prototype, 'parentElement', {
  get: function() {
    'use strict';
    return this.closest(VNode.isElementNode);
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


// Because it is generated lazily, callers are advised to cache. However,
// if doing mutation while iterating over child nodes, then use sibling
// pointers to do traversal instead, because this is an array, not a NodeList,
// so it is like a non-live nodelist, so errors will result if doing things
// like inserting nodes or deleting nodes in or around these nodes
// Also, this allocates an array, which doesn't happen if you just directly
// traverse.
Object.defineProperty(VNode.prototype, 'childNodes', {
  get: function() {
    'use strict';
    const childNodes = new Array();
    for(let node = this.firstChild; node; node = node.nextSibling) {
      childNodes.push(node);
    }
    return childNodes;
  }
});

// Returns the node that is at the root of this node's tree, which may be
// itself. Exploits the fact that the only node that is the root is
// the one without a parentNode.
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

// See http://stackoverflow.com/questions/4059147
VNode._isString = function(value) {
  return Object.prototype.toString.call(value) === '[object String]';
};

VNode.prototype.setAttribute = function(name, value) {
  'use strict';
  if(!this.attributes) {
    this.attributes = new Map();
  }

  // Force some magical minor cleaning of the value as a convenience
  let storedValue = VNode._isString(value) ? value : '';
  storedValue = storedValue.trim();
  this.attributes.set(name, storedValue);
};

VNode.prototype.hasAttribute = function(name) {
  'use strict';
  return this.getAttribute(name);
};

VNode.prototype.removeAttribute = function(name) {
  'use strict';
  if(this.attributes) {
    this.attributes.delete(name);
    if(!this.attributes.size) {
      this.attributes = null;
    }
  }
};

// Pre-order DFS visiting of child nodes, including self
// NOTE: i don't like how this requires N function calls
VNode.prototype.traverse = function(callback) {
  'use strict';
  callback(this);
  for(let node = this.firstChild; node; node = node.nextSibling) {
    node.traverse(callback);
  }
};

// Like traverse, but does not call traverse2 per node
// Also includes self
VNode.prototype.traverse2 = function(callback) {
  'use strict';
  const stack = [this];
  let node = null;
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

// See Source/WebCore/dom/Node.cpp
// I am not sure I need to implement. When I convert to dom, it is done
// automatically I think? Or I could implement but never call for now
// This does two things:
// Removes empty text nodes from the set of descendants, self excluded
// Merges adjacent text nodes from the set of descendants, self excluded
VNode.prototype.normalize = function() {
  'use strict';

  // How to implement? We want to iterate over all text nodes,
  // but we have to be careful about mutations. I suppose I could
  // rewrite the stack-based traversal function here, taking care to
  // update how we reach the next node if a mutation is going to happen
  // The alternative is to implement something like a TreeWalker that
  // is smart enough to handle DOM mutations. But I think that would require
  // some messy event listener junk? I'd prefer to keep this lean and
  // only minimally functional, even if it is inelegant and violates DRY.

  throw new Error('Not implemented');
};

// Searches all descendants, self included, for the first node to match
// the given predicate function, and returns the first match or null.
VNode.prototype.search = function(predicate) {
  'use strict';

  // I've chosen to re-implement the stack based DFS pre-order traversal
  // approach here, because of the short circuiting logic that does not
  // belong in the other method.

  const stack = [this];
  let node = null;
  let found = false;
  let match = null;
  while(!match && stack.length) {
    node = stack.pop();

    // TODO: exclude the node itself? or should i start from
    // this.firstChild above? If I start above I have to also
    // visit siblings
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

// Allocates a new dense array containing matching nodes. Assumes name is
// well-formed. Less efficient than just raw traversal because you will just
// be traversing the array again, and this requires extraneous work. Also may
// have issues with mutation while iterating. Excludes the node upon which
// this function is called (only looks at descendants of this node).
VNode.prototype.getElementsByName = function(name) {
  'use strict';
  const elements = new Array();
  this.traverse((node) => {
    if(node !== this && node.name === name) {
      elements.push(node);
    }
  });
  return elements;
};

VNode.isElementWithId = function(id, node) {
  return node.isElement() && id === node.id;
};

// Not optimized what-so-ever. Should only be called on the root node if you
// want to search all nodes.
VNode.prototype.getElementById = function(id) {
  'use strict';
  if(id) {
    const isElementWithId = VNode.isElementWithId.bind(null, id);
    return this.search(isElementWithId);
  }
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

Object.defineProperty(VNode.prototype, 'rows', {
  get: function() {
    'use strict';

    // NOTE: the current implementation is rather strict and does not account
    // for things like intermediate wrapping elements within a table element,
    // and doesn't check against nested tables all that well

    const rows = [];
    const sections = [];

    // This property should only be defined on table nodes, but I define
    // it on all nodes for convenience, so we have to check
    if(!this.isTable()) {
      return rows;
    }

    for(let node = this.firstChild; node; node = node.nextSibling) {
      if(node.isTableRow()) {
        rows.push(node);
      } else if(node.isTableSection()) {
        sections.push(node);
      }
    }

    for(let section of sections) {
      for(let node = section.firstChild; node; node = node.nextSibling) {
        if(node.isTableRow()) {
          rows.push(node);
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
    const columns = [];
    if(!this.isTableRow()) {
      return columns;
    }
    for(let node = this.firstChild; node; node = node.nextSibling) {
      if(node.isTableCell()) {
        columns.push(node);
      }
    }
    return columns;
  }
});

// Generates a VNode representation of a DOM node. Does not do any linking to
// other vnodes (you have to appendChild or something). Does not inspect
// more deeply and bring in dom child nodes as well. Returns undefined
// if cannot create the node (e.g. tried to import a comment).
VNode.fromDOMNode = function(node) {
  'use strict';

  const vNode = new VNode();
  if(node.nodeType === Node.ELEMENT_NODE) {
    vNode.type = node.nodeType;
  } else if(node.nodeType === Node.TEXT_NODE) {
    vNode.type = node.nodeType;
  } else {
    console.debug('Unsupported node type: ', node);
    return;
  }

  if(vNode.isText()) {
    vNode.value = node.nodeValue;
  } else {
    vNode.name = node.localName;

    const attributes = node.attributes;
    const numAttributes = attributes.length;
    for(let i = 0, attribute, name; i < numAttributes; i++) {
      attribute = attributes[i];
      name = attribute.name;
      vNode.setAttribute(name, node.getAttribute(name));
    }

    if(node.width && !vNode.hasAttribute('width')) {
      vNode.setAttribute('width', String(node.width));
    }

    if(node.height && !vNode.hasAttribute('height')) {
      vNode.setAttribute('height', String(node.height));
    }
  }

  return vNode;
};



VNode.prototype.toString = function() {
  'use strict';

  if(this.isText()) {
    return '"' + this.value + '"';
  } else {
    let buffer = [];
    buffer.push('<');
    buffer.push(this.name);
    for(let entry of this.attributes) {
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

Object.defineProperty(VNode.prototype, 'outerHTML', {
  get: function() {
    // Treat the current node as document like. Create a dom starting this
    // with node as the root, then call outerHTML on its root node.
    return 'not implemented';
  }
});

// Create a tree of VNodes from an HTMLDocument
VNode.fromHTMLDocument = function(document) {
  'use strict';
  throw new Error('Not implemented');
};

// Creates an returns a new HTMLDocument instance from this VNode and its
// connected nodes. tree should be the root VNode of a VNode tree.
VNode.toHTMLDocument = function(tree) {
  'use strict';
  throw new Error('Not implemented');
};
