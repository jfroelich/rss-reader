// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Virtual dom functionality

// Type constants
// Using var because i don't think i can use const in glob scope
// without global strict mode, and i don't feel like using an IIFE yet
var VNode_ELEMENT = Node.ELEMENT_NODE;
var VNode_TEXT = Node.TEXT_NODE;
var VNode_COMMENT = Node.COMMENT_NODE;

// TODO: drop comment support, we filter them anyway, the filtering
// can be implicit

function VNode() {
  'use strict';
  this.parentNode = null;
  this.firstChild = null;
  this.lastChild = null;
  this.nextSibling = null;
  this.previousSibling = null;

  // todo: use _name to emphasize distiction from Function.name?
  this.name = null;
  this.value = null;
  this.type = null;

  // TODO: due to remarkably poor performance, stop supporting
  // variable attributes. instead, just hardcode a specific subset
  // and modify to/from dom node functions to deal with setting

  // where possible, access by property instead of getAttribute which has
  // ridiculously slow perf

  // Support:
  // 'src'
  // See DOMFilter/VPrune isPermittedAttribute for more

  // eager alloc
  // using basic object instead of map since keys are always strings
  // and Map profiling shows bad perf
  this.attributes = {};
}


VNode.createElement = function VNode_createElement(name) {
  'use strict';
  const element = new VNode();
  element.type = VNode_ELEMENT;
  element.name = name;
  return element;
};

VNode.createTextNode = function VNode_createTextNode(value) {
  'use strict';
  const node = new VNode();
  node.type = VNode_TEXT;

  // NOTE: we don't validate incoming values
  // so just directly set the value
  node.value = value;
  //node.nodeValue = value;

  return node;
};

VNode.createComment = function VNode_createComment(value) {
  'use strict';
  const node = new VNode();
  node.type = VNode_COMMENT;
  node.value = value;
  return node;
};

Object.defineProperty(VNode.prototype, 'nodeValue', {
  get: function VNode_getNodeValue() {
    'use strict';
    if(this.type === VNode_TEXT) {
      return this.value;
    }
  },
  set: function VNode_setNodeValue(value) {
    'use strict';
    if(this.type === VNode_TEXT) {
      if(value === null) {
        this.value = value;
      } else if(typeof value === 'undefined') {
        this.value = value;
      } else if(VNode.isString(value)) {
        this.value = value;
      } else {
        this.value = '' + value;
      }
    }
  }
});

// NOTE: untested
Object.defineProperty(VNode.prototype, 'textContent', {
  set: function VNode_setTextContent(value) {
    'use strict';
    if(this.type === VNode_ELEMENT) {
      // https://www.w3.org/TR/DOM-Level-3-Core/core.html#Node3-textContent
      // On setting, any possible children this node may have are removed and,
      // if it the new string is not empty or null, replaced by a single Text
      // node containing the string this attribute is set to.
      const childNodes = this.childNodes;
      for(let i = 0, len = childNodes.length; i < len; i++) {
        childNodes[i].remove();
      }

      // TODO: avoid creating/appending if the value is null/undefined
      const newChildTextNode = VNode.createTextNode(value);
      this.appendChild(newChildTextNode);
    } else if(this.type === VNode_TEXT) {
      this.nodeValue = value;
    } else if(this.type === VNode_COMMENT) {
      this.value = value;
    }
  }
});


// Returns whether this node may contain the child node
// TODO: deprecate
VNode.prototype.mayContain = function VNode_mayContain(childNode) {

  if(this.type !== VNode_ELEMENT) {
    return false;
  }

  if(this === childNode) {
    return false;
  }

  if(childNode.type === VNode_ELEMENT) {

    // If this node is a descendant of the child node, then it cannot
    // contain the child node
    if(childNode.contains(this)) {
      return false;
    }

    // If this node is a void element, then it may not contain child elements
    // See: http://w3c.github.io/html-reference/syntax.html
    switch(this.name) {
      case 'applet':
      case 'area':
      case 'base':
      case 'br':
      case 'col':
      case 'command':
      case 'embed':
      case 'frame':
      case 'hr':
      case 'img':
      case 'input':
      case 'iframe':
      case 'isindex':
      case 'keygen':
      case 'link':
      case 'noframes':
      case 'noscript':
      case 'meta':
      case 'object':
      case 'param':
      case 'script':
      case 'source':
      case 'style':
      case 'track':
      case 'wbr':
        return false;
      default:
        return true;
    }
  }

  return true;
};

// Returns whether this node contains the child node
// This node contains the child node if this node is an ancestor
// of the child node. It seems faster to search the ancestors of the
// child than to search descendants because there tends to be
// fewer ancestors.
VNode.prototype.contains = function VNode_contains(childNode) {
  'use strict';
  for(let node = childNode.parentNode; node; node = node.parentNode) {
    if(node === this) {
      return true;
    }
  }
};

// Returns whether the child node was appended
VNode.prototype.appendChild = function VNode_appendChild(childNode) {
  'use strict';
  if(!childNode)
    return true;

  // Temp, disabled for now, caller responsibility
  // This may be entirely deprecated. I see no reason why to check, let the
  // caller violate
  //if(!this.mayContain(childNode))
  //  return false;

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
VNode.prototype.insertBefore = function VNode_insertBefore(node,
  referenceNode) {
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

  //if(!this.mayContain(node))
  //  return false;

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
VNode.prototype.replaceChild = function VNode_replaceChild(newChild,
  oldChild) {
  'use strict';
  return this.insertBefore(newChild, oldChild) && oldChild.remove();
};

// Detaches this node from its tree and returns true.
VNode.prototype.remove = function VNode_remove() {
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
VNode.prototype.closest = function VNode_closest(predicate, includeSelf) {
  'use strict';
  for(let cursor = includeSelf ? this : this.parentNode; cursor;
    cursor = cursor.parentNode) {
    if(predicate(cursor))
      return cursor;
  }
};

Object.defineProperty(VNode.prototype, 'parentElement', {
  get: function VNode_getParentElement() {
    'use strict';
    return this.parentNode;
  }
});

Object.defineProperty(VNode.prototype, 'ownerDocument', {
  get: function VNode_getOwnerDocument() {
    'use strict';
    return this.closest(function isOrphanNode(node) {
      return !node.parentNode;
    }, true);
  }
});

Object.defineProperty(VNode.prototype, 'body', {
  get: function VNode_getBody() {
    'use strict';
    // This is only defined on the documentElement
    if(this.type !== VNode_ELEMENT || this.name !== 'html' ||
      this.parentNode) {
      return;
    }

    // Search only within the immediate children
    for(let element = this.firstElementChild; element;
      element = element.nextElementSibling) {
      if(element.name === 'body' || element.name === 'frameset') {
        return element;
      }
    }
  },
  set: function VNode_setBody(node) {
    'use strict';
    if(this.type !== VNode_ELEMENT || this.name !== 'html' ||
      this.parentNode || node.type !== VNode_ELEMENT) {
      return;
    }
    this.replaceChild(node, this.body);
  }
});

Object.defineProperty(VNode.prototype, 'firstElementChild', {
  get: function VNode_getFirstElementChild() {
    'use strict';
    const ELEMENT = VNode_ELEMENT;
    for(let node = this.firstChild; node; node = node.nextSibling) {
      if(node.type === ELEMENT)
        return node;
    }
  }
});

Object.defineProperty(VNode.prototype, 'nextElementSibling', {
  get: function VNode_getNextElementSibling() {
    'use strict';
    const ELEMENT = VNode_ELEMENT;
    for(let node = this.nextSibling; node; node = node.nextSibling) {
      if(node.type === ELEMENT)
        return node;
    }
  }
});

Object.defineProperty(VNode.prototype, 'lastElementChild', {
  get: function VNode_getLastElementChild() {
    'use strict';
    const ELEMENT = VNode_ELEMENT;
    for(let node = this.lastChild; node; node = node.previousSibling) {
      if(node.type === ELEMENT)
        return node;
    }
  }
});

Object.defineProperty(VNode.prototype, 'childElementCount', {
  get: function VNode_getChildElementCount() {
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
  get: function VNode_getChildNodes() {
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
VNode.prototype.traverse = function VNode_traverse(visitorFunction,
  includeSelf) {
  'use strict';
  const stack = [];
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

// Searches descendants for the first node to match the predicate. Also tests
// against this node if includeSelf is true.
VNode.prototype.find = function VNode_find(predicate, includeSelf) {
  'use strict';
  const stack = [];
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
    if(predicate(node)) {
      return node;
    }
    node = node.lastChild;
    while(node) {
      stack.push(node);
      node = node.previousSibling;
    }
  }
};

// Returns a static array of descendants matching the predicate. Includes
// this node if includeSelf is true.
VNode.prototype.findAll = function VNode_findAll(predicate, includeSelf) {
  'use strict';
  const matches = [];

  const stack = [];
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

    if(predicate(node)) {
      matches.push(node);
    }

    node = node.lastChild;
    while(node) {
      stack.push(node);
      node = node.previousSibling;
    }
  }

  return matches;
};

// Similar to findAll, but once a node is matched, its descendants are
// ignored
VNode.prototype.findAllShallow = function VNode_findAllShallow(predicate,
  includeSelf) {
  'use strict';
  const matches = [];
  const stack = [];
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
    if(predicate(node)) {
      matches.push(node);
    } else {
      // Only push children onto the stack if the node did not match
      node = node.lastChild;
      while(node) {
        stack.push(node);
        node = node.previousSibling;
      }
    }
  }
  return matches;
};

// See http://stackoverflow.com/questions/4059147
VNode.isString = function VNode_isString(value) {
  'use strict';
  return typeof value === 'string' ||
    Object.prototype.toString.call(value) === '[object String]';
};

VNode.prototype.getElementsByName = function VNode_getElementsByName(name,
  includeSelf) {
  'use strict';
  return this.findAll(function isElementWithName(node) {
    return node.type === VNode_ELEMENT && node.name === name;
  }, includeSelf);
};

VNode.prototype.getAttribute = function VNode_getAttribute(name) {
  'use strict';
  return this.attributes[name];
};

// It is caller's responsibly to use strings, no sanity guard
VNode.prototype.setAttribute = function VNode_setAttribute(name, value) {
  'use strict';
  this.attributes[name] = value;
};

VNode.prototype.hasAttribute = function VNode_hasAttribute(name) {
  'use strict';
  return this.attributes[name];
};

VNode.prototype.removeAttribute = function VNode_removeAttribute(name) {
  'use strict';
  delete this.attributes[name];
};

// TODO: maybe rather than parseInt each access, have all nodes
// provide _width and _height that is updated each time
// the corresponding setAttribute is called
Object.defineProperty(VNode.prototype, 'width', {
  get: function VNode_getWidth() {
    'use strict';
    if(this.type !== VNode_ELEMENT)
      return;

    const widthString = this.getAttribute('width');
    if(!widthString)
      return;
    // TODO: remove units like 'w'?
    try {
      return parseInt(widthString, 10);
    } catch(exception) {
      console.debug('Invalid width:', widthString);
    }
  }
});

Object.defineProperty(VNode.prototype, 'height', {
  get: function VNode_getHeight() {
    'use strict';
    if(this.type !== VNode_ELEMENT)
      return;

    const heightString = this.getAttribute('height');
    if(!heightString)
      return;
    // TODO: remove units like 'w'?
    try {
      return parseInt(heightString, 10);
    } catch(exception) {
      console.debug('Invalid height:', heightString);
    }
  }
});

Object.defineProperty(VNode.prototype, 'id', {
  get: function VNode_getId() {
    'use strict';
    if(this.type === VNode_ELEMENT) {
      return this.getAttribute('id');
    }
  },
  set: function VNode_setId(value) {
    'use strict';
    if(this.type === VNode_ELEMENT) {
      this.setAttribute('id', value);
    }
  }
});

VNode.prototype.getElementById = function VNode_getElementById(id,
  includeSelf) {
  'use strict';

  if(!VNode.isString(id)) {
    return;
  }

  if(this.type !== VNode_ELEMENT) {
    return;
  }

  return this.find(function nodeHasId(node) {
    return node.id === id;
  }, includeSelf);
};

VNode.prototype.createIdMap = function VNode_createIdMap() {
  'use strict';
  const map = new Map();
  this.traverse(function putNode(node) {
    if(node.type === VNode_ELEMENT) {
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
  get: function VNode_getRows() {
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
  get: function VNode_getCols() {
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

Object.defineProperty(VNode.prototype, 'outerHTML', {
  get: function VNode_getOuterHTML() {
    'use strict';
    return VNode.translate(this).outerHTML;
  }
});

// Generates a VNode representation of a DOM node. Does not do any linking to
// other vnodes.
function VNode_fromDOMNode(node) {
  'use strict';
  if(node.nodeType === Node.ELEMENT_NODE) {
    const element = VNode.createElement(node.localName);

    // TODO: this is surprisingly slow
    // Maybe only support certain attributes and just access them
    // directly?
    // and in that case, prefer property access to getAttribute?
    // maybe init vnode.attributes as a typed object?
    // or maybe screw all of that, just hardcode properties on the
    // VNode object itself.
    //var attributes = node.attributes;
    //var numAttributes = attributes.length;
    //for(var i = 0, attribute, name, value; i < numAttributes; i++) {
    //  attribute = attributes[i];
    //  name = attribute.name;
    //  value = node.getAttribute(name);
    //  element.setAttribute(name, value);
    //}
    return element;
  } else if(node.nodeType === Node.TEXT_NODE) {
    return VNode.createTextNode(node.nodeValue);
  } else if(node.nodeType === Node.COMMENT_NODE) {
    return VNode.createComment(node.nodeValue);
  }
}

function VNode_toDOMNode(virtualNode) {
  'use strict';
  switch(virtualNode.type) {
    case VNode_TEXT:
      return document.createTextNode(virtualNode.value);
    case VNode_ELEMENT:
      var element = document.createElement(virtualNode.name);
      //const attributes = virtualNode.attributes || {};
      //let value = null;
      //for(let name in attributes) {
      //  element.setAttribute(name, attributes[name]);
      //}
      return element;
    case VNode_COMMENT:
      return document.createComment(virtualNode.value);
    default:
      break;
  }
}

// Translates between a dom node and a virtual node, including descendants,
// in either direction (virtual to real or real to virtual)
// TODO: see http://www.html5rocks.com/en/tutorials/speed/v8/
// Is inputNode causing polymorphic behavior because it can be
// VNode or real node? Maybe not important.

function VNode_translate(inputNode) {
  'use strict';

  const translateNode = inputNode instanceof VNode ?
    VNode_toDOMNode : VNode_fromDOMNode;

  const stack = [];
  let result = null;
  let parentNode = null;
  let childNode = null;
  let translatedNode = null;
  let appended = false;

  stack.push(inputNode, null);

  while(stack.length) {
    parentNode = stack.pop();
    childNode = stack.pop();
    translatedNode = translateNode(childNode);
    if(translatedNode) {
      if(parentNode) {
        appended = parentNode.appendChild(translatedNode);
      } else {
        result = translatedNode;
        appended = true;
      }

      if(appended) {
        childNode = childNode.lastChild;
        while(childNode) {
          stack.push(childNode, translatedNode);
          childNode = childNode.previousSibling;
        }
      }
    }
  }
  return result;
}
