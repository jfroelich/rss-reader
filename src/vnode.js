// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Virtual dom functionality

function VNode() {
  'use strict';
  this.parentNode = null;
  this.firstChild = null;
  this.lastChild = null;
  this.nextSibling = null;
  this.previousSibling = null;
  this.name = null;
  this.value = null;
  this.type = null;
  this.attributes = null;
}

// Type constants
VNode.TEXT = Node.TEXT_NODE;
VNode.ELEMENT = Node.ELEMENT_NODE;

VNode.createElement = function(name) {
  'use strict';
  const element = new VNode();
  element.type = VNode.ELEMENT;
  element.name = name;
  return element;
};

VNode.createTextNode = function(value) {
  'use strict';
  const node = new VNode();
  node.type = VNode.TEXT;
  node.nodeValue = value;
  return node;
};

Object.defineProperty(VNode.prototype, 'nodeValue', {
  get: function() {
    'use strict';
    return this.value;
  },
  set: function(value) {
    'use strict';
    this.value = value === null || typeof value === 'undefined' ||
      VNode.isString(value) ? value : '' + value;
  }
});

// See: http://w3c.github.io/html-reference/syntax.html
VNode.VOID_ELEMENT_NAMES = new Set([
  'applet',
  'area',
  'base',
  'br',
  'col',
  'command',
  'embed',
  'frame',
  'hr',
  'img',
  'input',
  'iframe',
  'isindex',
  'keygen',
  'link',
  'noframes',
  'noscript',
  'meta',
  'object',
  'param',
  'script',
  'source',
  'style',
  'track',
  'wbr'
]);

// Returns whether this node may contain the child node
VNode.prototype.mayContain = function(childNode) {
  return this.type === VNode.ELEMENT && this !== childNode &&
    (childNode.type === VNode.ELEMENT ?
    !VNode.VOID_ELEMENT_NAMES.has(this.name) &&
    !childNode.contains(this) : true);
};

// Returns whether this node contains the child node
VNode.prototype.contains = function(childNode) {
  'use strict';
  const self = this;
  return !!childNode.closest(function isParentSelf(node) {
    return node === self;
  }, false);
};

// Returns whether the child node was appended
VNode.prototype.appendChild = function(childNode) {
  'use strict';
  if(!childNode)
    return true;
  if(!this.mayContain(childNode))
    return false;
  const currentLastChild = this.lastChild;
  if(currentLastChild === childNode)
    return true;
  childNode.remove();
  childNode.parentNode = this;
  if(currentLastChild) {
    childNode.previousSibling = currentLastChild;
    currentLastChild.nextSibling = childNode;
  } else {
    this.firstChild = childNode;
  }
  this.lastChild = childNode;
  return true;
};

// Inserts the node as the previous sibling of the reference node
VNode.prototype.insertBefore = function(node, referenceNode) {
  'use strict';
  if(!node)
    return true;
  if(!referenceNode)
    return this.appendChild(node);
  if(referenceNode.parentNode !== this)
    return false;
  if(referenceNode.previousSibling === node)
    return true;
  if(node === referenceNode)
    return true;
  if(!this.mayContain(node))
    return false;
  node.remove();
  node.parentNode = this;
  node.nextSibling = referenceNode;
  const oldPreviousSibling = referenceNode.previousSibling;
  if(oldPreviousSibling) {
    oldPreviousSibling.nextSibling = node;
    node.previousSibling = oldPreviousSibling;
  } else {
    this.firstChild = node;
  }
  referenceNode.previousSibling = node;
  return true;
};

// Replaces the old child node with the new child node
VNode.prototype.replaceChild = function(newChild, oldChild) {
  'use strict';
  return this.insertBefore(newChild, oldChild) && oldChild.remove();
};

// Detaches this node from its tree and returns true.
VNode.prototype.remove = function() {
  'use strict';
  const parentNode = this.parentNode;
  const nextSibling = this.nextSibling;
  const previousSibling = this.previousSibling;
  if(!parentNode)
    return true;
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

// Finds the closest ancestor matching the predicate
VNode.prototype.closest = function(predicate, includeSelf) {
  'use strict';
  for(let cursor = includeSelf ? this : this.parentNode; cursor;
    cursor = cursor.parentNode) {
    if(predicate(cursor))
      return cursor;
  }
};

Object.defineProperty(VNode.prototype, 'parentElement', {
  get: function() {
    'use strict';
    return this.parentNode;
  }
});

Object.defineProperty(VNode.prototype, 'root', {
  get: function() {
    'use strict';
    return this.closest(function isOrphanNode(node) {
      return !node.parentNode;
    }, true);
  }
});

Object.defineProperty(VNode.prototype, 'firstElementChild', {
  get: function() {
    'use strict';
    const ELEMENT = VNode.ELEMENT;
    for(let node = this.firstChild; node; node = node.nextSibling) {
      if(node.type === ELEMENT)
        return node;
    }
  }
});

Object.defineProperty(VNode.prototype, 'nextElementSibling', {
  get: function() {
    'use strict';
    const ELEMENT = VNode.ELEMENT;
    for(let node = this.nextSibling; node; node = node.nextSibling) {
      if(node.type === ELEMENT)
        return node;
    }
  }
});

Object.defineProperty(VNode.prototype, 'lastElementChild', {
  get: function() {
    'use strict';
    const ELEMENT = VNode.ELEMENT;
    for(let node = this.lastChild; node; node = node.previousSibling) {
      if(node.type === ELEMENT)
        return node;
    }
  }
});

Object.defineProperty(VNode.prototype, 'childElementCount', {
  get: function() {
    'use strict';
    let count = 0;
    for(let element = this.firstElementChild; element;
      element = element.nextElementSibling) {
      count++;
    }
    return count;
  }
});

Object.defineProperty(VNode.prototype, 'childNodes', {
  get: function() {
    'use strict';
    const nodes = [];
    for(let node = this.firstChild; node; node = node.nextSibling) {
      nodes.push(node);
    }
    return nodes;
  }
});

// Traverses the descendants of the root node in pre-order, depth first order,
// calling callback on each descendant node.
VNode.prototype.traverse = function(visitorFunction, includeSelf) {
  'use strict';
  const stack = new Array(50);
  let node = this;
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
    visitorFunction(node);
    node = node.lastChild;
    while(node) {
      stack.push(node);
      node = node.previousSibling;
    }
  }
};

// Searches descendants, excluding this node, for the first node to match
// the predicate
// TODO: use an includeSelf param like traverse?
VNode.prototype.find = function(predicate) {
  'use strict';
  const stack = [this];
  let node;
  while(stack.length) {
    node = stack.pop();
    if(predicate(node)) {
      return node;
    } else {
      node = node.lastChild;
      while(node) {
        stack.push(node);
        node = node.previousSibling;
      }
    }
  }
};

// Returns a static array of descendants matching the predicate
VNode.prototype.findAll = function(predicate, includeSelf) {
  'use strict';
  const matches = [];
  this.traverse(function(node) {
    if(predicate(node))
      matches.push(node);
  }, includeSelf);
  return matches;
};

// See http://stackoverflow.com/questions/4059147
VNode.isString = function(value) {
  'use strict';
  return Object.prototype.toString.call(value) === '[object String]';
};

VNode.prototype.toString = function() {
  'use strict';
  if(this.type === VNode.TEXT) {
    return this.value;
  } else if(this.type === VNode.ELEMENT) {
    return VNode.toDOMNode(this).outerHTML;
  }
};

VNode.prototype.getElementsByName = function(name, includeSelf) {
  'use strict';
  return this.findAll(function nodeHasName(node) {
    return node.name === name;
  }, includeSelf);
};

VNode.prototype.getAttribute = function(name) {
  'use strict';
  if(this.attributes) {
    return this.attributes.get(name);
  }
};

VNode.prototype.setAttribute = function(name, value) {
  'use strict';
  if(this.type !== VNode.ELEMENT)
    return;
  this.attributes = this.attributes || new Map();
  let storedValue = '';
  if(value === null || typeof value === 'undefined') {
    // leave storedValue as ''
  } else if(VNode.isString(value)) {
    storedValue = value;
  } else {
    storedValue += value;
  }
  this.attributes.set(name, storedValue);
};

VNode.prototype.hasAttribute = function(name) {
  'use strict';
  return !!this.getAttribute(name);
};

VNode.prototype.removeAttribute = function(name) {
  'use strict';
  if(this.type === VNode.ELEMENT && this.attributes) {
    this.attributes.delete(name);
    if(!this.attributes.size) {
      this.attributes = null;
    }
  }
};

Object.defineProperty(VNode.prototype, 'id', {
  get: function() {
    'use strict';
    return this.getAttribute('id');
  },
  set: function(value) {
    'use strict';
    this.setAttribute('id', value);
  }
});

// TODO: provide includeSelf param? does it include self?
VNode.prototype.getElementById = function(id) {
  'use strict';
  return this.find(function nodeHasId(node) {
    return node.id === id;
  });
};

VNode.prototype.createIdMap = function() {
  'use strict';
  const map = new Map();
  this.traverse(function putNode(node) {
    if(node.type === VNode.ELEMENT) {
      const id = node.id;
      // Favor nodes visited earlier
      if(id && !map.has(id)) {
        map.set(id, node);
      }
    }
  }, true);
  return map;
};

Object.defineProperty(VNode.prototype, 'rows', {
  get: function() {
    'use strict';
    if(this.name !== 'table')
      return;
    let subElement;
    const sections = new Set(['thead', 'tbody', 'tfoot']);
    const rows = [];
    for(let element = this.firstElementChild, name; element;
      element = element.nextElementSibling) {
      name = element.name;
      if(name === 'tr') {
        rows.push(element);
      } else if(sections.has(name)) {
        for(subElement = element.firstElementChild; subElement;
          subElement = subElement.nextElementSibling) {
          if(subElement.name === 'tr') {
            rows.push(subElement);
          }
        }
      }
    }
    return rows;
  }
});

Object.defineProperty(VNode.prototype, 'cols', {
  get: function() {
    'use strict';
    if(this.name !== 'tr')
      return;
    const columns = [];
    for(let element = this.firstElementChild; element;
      element = element.nextElementSibling) {
      if(element.name === 'td') {
        columns.push(element);
      }
    }
    return columns;
  }
});

// Generates a VNode representation of a DOM node. Does not do any linking to
// other vnodes.
VNode.fromDOMNode = function(node) {
  'use strict';
  let vNode;
  if(node.nodeType === Node.ELEMENT_NODE) {
    vNode = VNode.createElement(node.localName);
    const attributes = node.attributes;
    const numAttributes = attributes.length;
    for(let i = 0, attribute, attributeName; i < numAttributes; i++) {
      attribute = attributes[i];
      attributeName = attribute.name;
      vNode.setAttribute(attributeName, node.getAttribute(attributeName));
    }

    if(node.width && !vNode.hasAttribute('width')) {
      vNode.setAttribute('width', node.width);
    }

    if(node.height && !vNode.hasAttribute('height')) {
      vNode.setAttribute('height', node.height);
    }

  } else if(node.nodeType === Node.TEXT_NODE) {
    vNode = VNode.createTextNode(node.nodeValue);
  }

  return vNode;
};

VNode.toDOMNode = function(virtualNode) {
  'use strict';
  if(virtualNode.type === VNode.TEXT) {
    return document.createTextNode(virtualNode.value);
  } else if(virtualNode.type === VNode.ELEMENT) {
    const element = document.createElement(virtualNode.name);
    const attributes = virtualNode.attributes || [];
    for(let entry of attributes) {
      element.setAttribute(entry[0], entry[1]);
    }
    return element;
  }
};

// Creates a virtual tree from a Document, with the root of the tree
// representing document.documentElement
VNode.fromHTMLDocument = function(document) {
  'use strict';

  const Pair = function(virtualParent, currentNode) {
    this.virtualParent = virtualParent;
    this.currentNode = currentNode;
  };

  let virtualRoot = null;
  let pair = null;
  let virtualParent = null;
  let node = null;
  let virtualNode = null;
  let appended = false;
  const stack = [];

  if(!document || document.nodeType !== Node.DOCUMENT_NODE ||
    !document.documentElement ||
    document.documentElement.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  stack.push(new Pair(null, document.documentElement));
  while(stack.length) {
    pair = stack.pop();
    virtualParent = pair.virtualParent;
    node = pair.currentNode;
    virtualNode = VNode.fromDOMNode(node);

    if(!virtualNode) {
      continue;
    }

    if(virtualParent) {
      appended = virtualParent.appendChild(virtualNode);
    } else {
      virtualRoot = virtualNode;
      appended = true;
    }

    if(appended) {
      node = node.lastChild;
      while(node) {
        pair = new Pair(virtualNode, node);
        stack.push(pair);
        node = node.previousSibling;
      }
    }

  }
  return virtualRoot;
};

// Creates an returns a new HTMLDocument instance from this VNode and its
// connected nodes. tree should be the root VNode of a VNode tree.
VNode.toHTMLDocument = function(virtualNode) {
  'use strict';
  throw new Error('Not implemented');
};

// TODO: Treat the current node as document like. Create a dom starting this
// with node as the root, then call outerHTML on its root node.
VNode.getOuterHTML = function(virtualNode) {
  'use strict';
  throw new Error('Not implemented');
};
