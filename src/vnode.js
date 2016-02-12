// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Global strict mode is currently required in Chrome for ES6 class syntax
'use strict';

// Virtual dom library

class VNode {

  // This should not be called directly, use the static methods
  // such as createElement to create new vnodes.
  constructor() {
    this.parentNode = null;
    this.nextSibling = null;
    this.previousSibling = null;
  }

  // Returns a virtual text node with the given value
  static createTextNode(value) {
    return new VTextNode(value);
  }

  // Returns a virtual element with the given tag name
  static createElement(name) {
    let element = null;
    if(name === 'table') {
      element = new VTableElement();
    } else if(name === 'tr') {
      element = new VRowElement();
    } else {
      element = new VElement(name);
    }

    return element;
  }

  equals(otherNode) {
    return this === otherNode;
  }

  // Removing a node detaches the node from its tree. It breaks the edges
  // from the node's parent to the node, and breaks the edges between the node
  // and its siblings. It does NOT remove the links to the node's child nodes.
  // In other words, removing a node removes both the node and all of its
  // descendants. In addition, removing a node does not 'delete' the node. The
  // node still exists in memory and can be re-attached.
  // Returns whether the remove operation was successful. Currently, this
  // always returns true.
  remove() {

    // Store a reference to the parent node prior to removal
    const parentNode = this.parentNode;

    // If there is no parent, it is a successful no-op, not a failure
    if(!parentNode) {
      return true;
    }

    // Store sibling references prior to removal
    const nextSibling = this.nextSibling;
    const previousSibling = this.previousSibling;

    // Update the removed node's own references to other nodes, but leave
    // the references to this node's children intact.
    this.parentNode = null;
    this.nextSibling = null;
    this.previousSibling = null;

    // Update other nodes' references to this node
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
  }

  // Returns the closest ancestor node matching the predicate, or null
  closest(predicate, includeSelf) {
    let node = includeSelf ? this : this.parentNode;
    let result = null;
    while(!result && node) {
      if(predicate(node)) {
        result = node;
      } else {
        node = node.parentNode;
      }
    }
    return result;
  }

  // Child classes should overwrite this as appropriate
  isText() {
    return false;
  }

  // Child classes should overwrite this as appropriate
  isElement() {
    return false;
  }

  // Returns true if the node is an element
  static isElementNode(node) {
    return node.isElement();
  }

  // Finds and returns the first ancestor of this node that is an element
  get parentElement() {
    // If only elements can have children, because we restrict how virtual
    // nodes can be appended (assuming clients do not modify the properties
    // directly) then this is actually just O(1)
    // return this.closest(isElementNode, false);
    return this.parentNode;
  }

  // Returns true if the node does not have a parent node
  static isOrphan(node) {
    return !node.parentNode;
  }

  // Returns the node that is at the root of this node's tree, which could
  // be this node
  get root() {
    return this.closest(VElement.isOrphan, true);
  }

  // Traverses the descendants of this node in pre-order, depth first order,
  // calling callback on each descendant node.
  // @param includeSelf {boolean} whether to include the current node in the
  // traversal
  traverse(callback, includeSelf) {
    const stack = [];
    if(includeSelf) {
      stack.push(this);
    } else {
      let node = this.lastChild;
      while(node) {
        stack.push(node);
        node = node.previousSibling;
      }
    }

    while(stack.length) {
      let node = stack.pop();
      callback(node);
      node = node.lastChild;
      while(node) {
        stack.push(node);
        node = node.previousSibling;
      }
    }
  }


  // Searches descendants for the first node to match
  // the predicate
  // TODO: use an includeSelf param like traverse
  search(predicate) {
    const stack = [this];
    let node = null;
    let match = null;
    while(!match && stack.length) {
      node = stack.pop();
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
  }

  // Removes empty text nodes from the set of descendants, self excluded
  // Merges adjacent text nodes from the set of descendants, self excluded
  // TODO: if converting to DOM takes care of this, deprecate
  // TODO: if perf is poor, inline traversal or write a mutation-allowing
  // iterator
  normalize() {
    // Build a static list of descendant text nodes
    let nodes = [];
    this.traverse(function appendIfText(node) {
      if(node.isText()) {
        nodes.push(node);
      }
    }, false);

    // Get only empty text nodes, then remove them
    nodes.filter(function isEmptyTextNode(node) {
      return node.value === null || node.value === void 0;
    }).forEach(function removeNode(node) {
      node.remove();
    });

    // Regenerate the list
    nodes = [];
    this.traverse(function reappendIfText(node) {
      if(node.isText()) {
        nodes.push(node);
      }
    }, false);

    nodes.forEach(function maybeMergeIntoPrevious(node) {
      const prev = node.previousSibling;
      if(prev && prev.isText()) {
        // See http://jsperf.com/concat-vs-plus-vs-join
        prev.value = prev.value + node.value;
        node.remove();
      }
    });
  }

  // Generates a VNode representation of a DOM node. Does not do any linking to
  // other vnodes (you have to append). Does not inspect
  // more deeply and bring in dom child nodes. Returns undefined
  // if cannot create the node (e.g. tried to import a comment).
  static fromDOMNode(node) {
    let vNode = null;

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
        vNode.setAttribute('width', '' + node.width);
      }

      if(node.height && !vNode.hasAttribute('height')) {
        vNode.setAttribute('height', '' + node.height);
      }

    } else if(node.nodeType === Node.TEXT_NODE) {
      vNode = VNode.createTextNode(node.nodeValue);
    } else {
      return;
    }

    return vNode;
  }

  // Creates a virtual tree from a Document, with the root of the tree
  // representing document.documentElement
  static fromHTMLDocument(document) {
    const Pair = function(virtualParent, currentNode) {
      this.virtualParent = virtualParent;
      this.currentNode = currentNode;
    };

    if(!document || document.nodeType !== Node.DOCUMENT_NODE ||
      !document.documentElement ||
      document.documentElement.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    let virtualRoot = null;
    let pair = null;
    let parent = null;
    let node = null;
    let virtualNode = null;
    let appended = false;
    const stack = [];
    stack.push(new Pair(null, document.documentElement));
    while(stack.length) {
      pair = stack.pop();
      parent = pair.virtualParent;
      node = pair.currentNode;
      virtualNode = VNode.fromDOMNode(node);
      if(virtualNode) {
        if(parent) {
          appended = parent.appendChild(virtualNode);
        } else {
          virtualRoot = virtualNode;
          // treat the root as appended
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
    }
    return virtualRoot;
  }

  // Creates an returns a new HTMLDocument instance from this VNode and its
  // connected nodes. tree should be the root VNode of a VNode tree.
  static toHTMLDocument(tree) {
    throw new Error('Not implemented');
  }

  // TODO: Treat the current node as document like. Create a dom starting this
  // with node as the root, then call outerHTML on its root node.
  get outerHTML() {
    throw new Error('Not implemented');
  }

  // Returns whether the value is a string. This function doesn't really
  // belong here but I am not quite sure where to put it.
  // See http://stackoverflow.com/questions/4059147
  static isString(value) {
    return Object.prototype.toString.call(value) === '[object String]';
  }
}

// See http://www.howtocreate.co.uk/tutorials/javascript/dombasics
// 4KB is approximate max size of text node, and normalize does not work
// correctly sometimes (artificial truncate), or at all
// See http://stackoverflow.com/questions/4695187
// The maximum size of a single string is approx 512MB on certain platforms
class VTextNode extends VNode {
  constructor(value) {
    super();
    this.type = Node.TEXT_NODE;
    this.value = VTextNode._isStorable(value) ? value : '' + value;
  }

  static _isStorable(value) {
    return value === null ||
      typeof value === 'undefined' ||
      VNode.isString(value);
  }

  get nodeValue() {
    return this.value;
  }

  set nodeValue(value) {
    this.value = VTextNode._isStorable(value) ? value : '' + value;
  }

  isText() {
    return true;
  }

  toString() {
    return this.value;
  }

  toDOMNode() {
    return document.createTextNode(this.value);
  }
}

class VElement extends VNode {

  // Creates a new virtual element with the given tag name. The name should
  // be in lowercase.
  constructor(name) {
    super();
    this.type = Node.ELEMENT_NODE;
    this.name = name;
    this.firstChild = null;
    this.lastChild = null;
    this.attributes = null;
  }

  // Returns whether this node is allowed to contain the child node.
  // Throws an error if the child node is undefined.
  mayContain(childNode) {

    // A node is not allowed to contain itself
    if(this === childNode) {
      return false;
    }

    if(childNode.isElement()) {
      // If the child node is an element, but this node is a void element
      // that cannot contain other elements, then this element cannot contain
      // the child. We check whether the child node is an element first because
      // it is a shared condition, and because the map lookup is slower so
      // it is preferable to restrict when it is called. Also, we include the
      // test for whether the child is an element because we depart from the
      // spec, because we loosely allow void elements to contain child text
      // nodes, such as a <style> node.
      if(VElement.VOID_NAMES.has(this.name)) {
        return false;
      }

      // If the child node that is to be inserted is an element, then it can
      // contain other elements. However, if the child node is currently
      // an ancestor of this node, then this node cannot contain the child,
      // so the child cannot be appended/inserted into this node, because we
      // cannot convert an ancestor into a child of a descendant.
      if(childNode.contains(this)) {
        return false;
      }
    }

    // This node can contain the child node
    return true;
  }

  // Returns whether this node contains the child node. A node contains the
  // the child node when the node is an ancestor of the child node.
  contains(childNode) {

    // TODO: perf test and pick an implementation
    return !!childNode.closest((node) => node === this, false);

    /*let cursorNode = childNode.parentNode;
    let foundThisNodeAsParent = false;
    while(cursorNode && !foundThisNodeAsParent) {
      if(cursorNode === this) {
        foundThisNodeAsParent = true;
      } else {
        cursorNode = cursorNode.parentNode;
      }
    }
    return foundThisNodeAsParent;*/
  }

  appendChild(node) {

    // Attempting to append nothing is a successful no-op
    if(!node) {
      return true;
    }

    if(!this.mayContain(node)) {
      return false;
    }

    // Attempting to append the same last child again is a successful no-op.
    // This is quite different than just checking if the node already has this
    // node as a parent, because in that case, when the node being appended is
    // not the the last child, appendChild acts as a move operation by moving
    // the node from its current position to the end of the parent's child
    // nodes.
    if(this.lastChild === node) {
      return true;
    }

    // If the node was attached, detach it (keeping its child edges intact).
    // This also ensures that node.nextSibling is set to null.
    node.remove();

    // Create an edge relation between the parent and the appended node
    node.parentNode = this;

    // This always occurs, even if this.lastChild is undefined
    node.previousSibling = this.lastChild;

    if(this.lastChild) {
      // If this node has a lastChild prior to the append, then we know it
      // contains at least one other node. Link the previous lastChild to the
      // new node. This has to be done before we update the parent's
      // lastChild 'pointer' to the newly appended node.
      this.lastChild.nextSibling = node;
      // Because this is an append operation, and because there was at least one
      // other node prior to the append, we leave firstChild as is.
    } else {
      // If lastChild is undefined then the node does not contain any child
      // nodes prior to the append operation. This means that firstChild is also
      // undefined, and now must become defined because we are appending a new
      // child.
      this.firstChild = node;
    }

    // Regardless of whether the node contained nodes prior to the append,
    // the newly appended node is now the last child.
    this.lastChild = node;

    return true;
  }

  replaceChild(newChild, oldChild) {
    return this.insertBefore(newChild, oldChild) && oldChild.remove();
  }

  insertBefore(node, referenceNode) {

    // Inserting nothing is a successful no-op
    if(!node) {
      return true;
    }

    // referenceNode is optional. If it is unset, insertBefore degrades
    // into appendChild's behavior.
    if(!referenceNode) {
      return this.appendChild(node);
    }

    // For a reason unbeknownst to me, insertBefore is defined such that it
    // could be called with a referenceNode that has a different parent.
    // If this function was implemented in the form of
    // node.insertBefore(referenceNode) then there would be no need to do this
    // check, because the parent is implied by simply accessing the
    // referenceNode's parent. I guess if the function were implemented that
    // way, we would still need to have some logic that checked whether the
    // referenceNode has a parent.
    if(referenceNode.parentNode !== this) {
      return false;
    }

    // In order to be consistent with appendChild, this is a successful no-op
    if(referenceNode.previousSibling === node) {
      return true;
    }

    // Inserting a node before itself is a successful no-op, because we are
    // basically moving the node into its same position.
    if(node === referenceNode) {
      return true;
    }

    // This check does the most work, so we defer it until the end. This
    // also assures us that we do not try and insert the parent before
    // the referenceNode, because it checks that the parent is not equal to
    // the node. As an aside, I suppose that technically we could allow a
    // parent to be inserted before a reference, it would be some strange
    // unwrap logic?
    if(!this.mayContain(node)) {
      return false;
    }

    // Remove the node from its old tree (but keep the node's children intact).
    // We do this because we have to update the old tree in case we are
    // inserting a node that was already attached somewhere else.
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
  }

  // Override the base class function to always return true
  isElement() {
    return true;
  }

  // Returns the first child node of this node that is an element
  get firstElementChild() {
    let result = null;
    for(let node = this.firstChild; !result && node; node = node.nextSibling) {
      if(node.isElement()) {
        result = node;
      }
    }
    return result;
  }

  // Returns the last child node of this node that is an element
  get lastElementChild() {
    let result = null;
    for(let node = this.lastChild; !result && node;
      node = node.previousSibling) {
      if(node.isElement()) {
        result = node;
      }
    }
    return result;
  }

  // Returns the number of child nodes of this node that are elements
  get childElementCount() {
    let count = 0;
    for(let node = this.firstChild; node; node = node.nextSibling) {
      if(node.isElement()) {
        count++;
      }
    }
    return count;
  }

  // Allocates and returns an array of this nodes child nodes. This is a
  // static array, not a live node list like in the DOM.
  get childNodes() {
    const childNodes = [];
    for(let node = this.firstChild; node; node = node.nextSibling) {
      childNodes.push(node);
    }
    return childNodes;
  }

  // Returns a static array of matching descendant nodes.
  // In the spec, when called on a document, the behavior is equivalent to
  // includeSelf is true, but when called on an element, false. Here, I leave
  // the desired behavior up to the caller with the optional includeSelf
  // parameter.
  // TODO: perf test, I am not sure calling a function on every node is
  // very performant? Maybe I need to re-implement traverse
  getElementsByName(name, includeSelf) {
    const elements = [];
    this.traverse(function appendIfHasName(node) {
      if(node.name === name) {
        elements.push(node);
      }
    }, includeSelf);
    return elements;
  }

  // Returns the value of this element's attribute with the given name
  getAttribute(name) {
    if(this.attributes) {
      return this.attributes.get(name);
    }
  }

  // Sets the value of the named attribute on this element
  setAttribute(name, value) {
    if(!this.isElement()) {
      return;
    }

    if(!this.attributes) {
      this.attributes = new Map();
    }

    let storedValue = '';
    if(value === null || typeof value === 'undefined') {
    } else if(VNode.isString(value)) {
      storedValue = value;
    } else {
      // See http://jsperf.com/cast-to-string/13
      storedValue += value;
    }

    this.attributes.set(name, storedValue);
  }

  // Returns whether this element has the named attribute
  hasAttribute(name) {
    return this.getAttribute(name);
  }

  // Removes the named attribute from this element
  removeAttribute(name) {
    if(this.isElement() && this.attributes) {
      this.attributes.delete(name);
      if(!this.attributes.size) {
        this.attributes = null;
      }
    }
  }

  // Returns the value of the element's id attribute
  get id() {
    return this.getAttribute('id');
  }

  // Sets the id attribute to this value
  set id(value) {
    this.setAttribute('id', value);
  }

  // Not optimized what-so-ever. Limited to descendants of the node, including
  // self.
  // TODO: if search is changed to accept includeSelf parameter, this
  // can be changed to accept includeSelf parameter.
  getElementById(id) {
    if(VNode.isString(id)) {
      return this.search(function(node) {
        return id === node.id;
      });
    }
  }

  // Returns a map of ids to elements. When more than one element has the same
  // id, only the first element (in document order) is stored in the map.
  // Rather than calling getElementById, which traverses each time, consider
  // calling this once on a tree and then using a map lookup to get an element
  // by its id. Tree modification is not reflected in the map.
  static indexIds(tree) {
    const index = new Map();
    tree.traverse(function(node) {
      if(node.isElement()) {
        const id = node.id;
        if(id && !index.has(id)) {
          index.set(id, node);
        }
      }
    }, true);
    return index;
  }

  toDOMNode() {
    const node = document.createElement(this.name);
    const attributes = this.attributes || [];
    for(let entry of attributes) {
      node.setAttribute(entry[0], entry[1]);
    }
    return node;
  }

  // Returns a string representation of this element
  toString() {
    return this.toDOMNode().outerHTML;
  }
}

// These nodes should not contain other elements. Some of these nodes may
// still contain other text nodes. I am not aiming for perfect compliance.
// See: http://w3c.github.io/html-reference/syntax.html
// See: https://github.com/google/closure-library/blob/master/closure/goog
// /dom/dom.js
VElement.VOID_NAMES = new Set([
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

class VTableElement extends VElement {
  constructor() {
    super('table');
  }

  // NOTE: the current implementation does not allow for intermediate
  // wrapping elements such as the form element in
  // <table><form><tr>...</tr></form></table>
  get rows() {
    const rows = [];
    for(let node = this.firstChild, name; node; node = node.nextSibling) {
      name = node.name;
      if(node.name === 'tr') {
        rows.push(node);
      } else if(VTableElement.isSectionName(name)) {
        for(let snode = node.firstChild; snode; snode = snode.nextSibling) {
          if(snode.name === 'tr') {
            rows.push(snode);
          }
        }
      }
    }
    return rows;
  }

  static isSectionName(name) {
    return name === 'thead' || name === 'tbody' || name === 'tfoot';
  }
}

class VRowElement extends VElement {

  constructor() {
    super('tr');
  }

  // Returns a static array of this row's child columns
  get cols() {
    const columns = [];
    for(let node = this.firstChild; node; node = node.nextSibling) {
      if(node.name === 'td') {
        columns.push(node);
      }
    }
    return columns;
  }
}
