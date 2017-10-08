'use strict';

// This lib contains helpers for document transforms

// Replace an element with its children. Special care is taken to add spaces
// if the operation would result in adjacent text nodes.
function unwrap_element(element) {
  const parent_element = element.parentNode;

  // This is a violation of an invariant. Caller should never do this.
  ASSERT(parent_element, 'Cannot unwrap orphaned element');

  const prev_sibling = element.previousSibling;
  const next_sibling = element.nextSibling;
  const first_child = element.firstChild;
  const last_child = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = element.ownerDocument.createDocumentFragment();
  // Detach upfront for O(2) live dom ops, compared to O(n-children) otherwise
  element.remove();
  if(prev_sibling && prev_sibling.nodeType === TEXT &&
    first_child && first_child.nodeType === TEXT)
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  for(let node = first_child; node; node = element.firstChild)
    frag.appendChild(node);
  if(last_child && first_child !== last_child && next_sibling &&
    next_sibling.nodeType === TEXT && last_child.nodeType === TEXT)
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  // If next_sibling is undefined then insertBefore appends
  parent_element.insertBefore(frag, next_sibling);
}

function unwrap_elements(ancestor_element, selector) {
  if(ancestor_element && selector) {
    const elements = ancestor_element.querySelectorAll(selector);
    for(const element of elements)
      unwrap_element(element);
  }
}

// TODO: left this in global scope for now due to some odd dependencies. Remove
// the dependencies. Inline this function
function insert_children_before(parent_node, reference_node) {
  const ref_parent = reference_node.parentNode;
  for(let node = parent_node.firstChild; node; node = parent_node.firstChild)
    ref_parent.insertBefore(node, reference_node);
}

// Changes the tag name of an element. Event listeners are lost on rename. No
// checking is done regarding whether the result is semantically correct.
// @param copy_attrs {Boolean} optional, if true then attributes are maintained,
// defaults to true.
// @returns {Element} the new element that replaces the old one
function rename_element(element, new_element_name, copy_attrs) {
  ASSERT(new_element_name);

  if(typeof copy_attrs === 'undefined')
    copy_attrs = true;

  // Treat attempting to rename an element to the same name as a noop instead
  // of as a fatal assertion for caller convenience.
  if(element.localName === new_element_name.trim().toLowerCase())
    return;

  const parent_element = element.parentNode;
  if(!parent_element)
    return;
  const next_sibling = element.nextSibling;
  element.remove();
  const new_element = element.ownerDocument.createElement(new_element_name);

  if(copy_attrs) {
    const attrs = element.attributes;
    for(let i = 0, length = attrs.length; i < length; i++) {
      const attr = attrs[i];
      new_element.setAttribute(attr.name, attr.value);
    }
  }

  let child_node = element.firstChild;
  while(child_node) {
    new_element.appendChild(child_node);
    child_node = element.firstChild;
  }

  // If next_sibling is undefined then insertBefore simply appends
  return parent_element.insertBefore(new_element, next_sibling);
}

function rename_elements(ancestor_element, old_element_name, new_element_name,
  copy_attrs) {
  if(ancestor_element) {
    const elements = ancestor_element.querySelectorAll(old_element_name);
    for(const element of elements)
      rename_element(element, new_element_name, copy_attrs);
  }
}

/*

# About

rename_element solves the problem that the dom does not provide a native way
of renaming elements. element.tagName and element.localName are read only
properties.

rename_element works by creating a new element, then, moving and copying over
some information from the old element, and then replacing the old element with
the new element.

unwrap_element solves a similar problem in that the dom does not provide a
simple way of removing a node from the dom, but keeping its children within
the dom in the same location.

# Event listeners are not maintained on rename

* See https://stackoverflow.com/questions/15408394 for a basic explanation of
why event listeners are lost on rename.
* See also https://stackoverflow.com/questions/9046741

# Why parent element is required when renaming/unwrapping

1. A removed element has no parent element. Renaming a removed element is
generally pointless.
2. This needs a way to re-insert an element back into the document, which
requires a parent element.

# Why the new element name is sanity checked when renaming

According to MDN docs, createElement(null) works like createElement("null")
so these guards avoid that.

# Alternate ways to implement element renaming

Detach the existing node, prior to performing other dom operations, so that
the other operations take place on a detached node. Implicitly, this sets
element.parentNode and element.nextSibling to undefined.
There is more than one way to do this function. The reason I've
implemented the function this way is because removing the node first is
O(2) live dom operations, whereas moving the children is O(n+1) live dom
operations. This way requires capturing the next_node reference, but that
probably is faster than touching the dom several times.

For example, see
https://www.quora.com/How-do-I-change-HTML-tag-name-in-JavaScript for what I
think is probably a slower implementation.

# About insertBefore's second argument

insertBefore's second argument is the reference node. According to MDN,
if the reference node is null, the new node (the 1st argument) is inserted
at the end of the list of the parent's child nodes.

Therefore, there is no need to explicitly test whether the reference node is
defined and use appendChild instead of insertBefore. insertBefore takes care
of the decision for us.

# Notes on batch moving of nodes

There does not appear to be a batch node move operation available in the dom
api. I spent some time looking and trying to come up with clever alternatives,
such as to_element.innerHTML = from_element.innerHTML, but nothing was better.

# TODO

* write tests
* research an authoritative resource on renaming elements and why this
function has to exist as opposed to some native functionality
* research whether I can use for..of on a NamedNodeMap when copying attributes

# TODO: improve unwrap performance when recursive

filter_unwrappable_elements is one of the slowest functions involved in document cleaning. It seems like this is primarily because unwrap_element is slow. Instead of optimizing unwrap, I am trying to reduce the number of calls to unwrap.

There are several situations where this is possible:

```
<p><inline><inline>text</inline></inline></p>
<p><inline>whitespace<inline>text</inline>whitespace</p>
<p><inline><inline>text</inline><inline>text</inline></inline></p>
```

So far I have two implementations, a naive version that unwraps everything, and a crappy more complex version that attempts to reduce the number of calls.

Unfortunately, the naive is still currently better performance. I think part of the problem is that the attempt doubles some of its logic, and involves recursion. For example, I am seeing in a profile that I drop the total time spent calling unwrap, because of the reduced number of calls, but the overhead of the filterUnwrappables function itself increases.

Another problem is due to the recently added support for detecting nesting of multiple inlines. For example, situation 3 above. I can now detect the nesting here, but now the call to unwrap with a 2nd argument works incorrectly. When it unwraps inline2 into p, it detaches inline2. However, it also detaches inline1 because that implicitly detaches inline2. And that is the source of the problem, because detaching inline1 implicitly detaches inline3, when inline3 should in fact still exist at that point. I am still working this out. Another thought is that maybe this isn't a problem. inline3 is still yet to be visited in the iteration of unwrapple elements. It will eventually be visited, and it will still have a parent. The problem is that the parent at that point is no longer attached.

I do not like that is_unwrappable_parent makes a call to match. It feels somehow redundant. match is also slow. one idea is to keep a set (or basic array) of the inline elements initially found, and just check set membership instead of calling matches

I do not like how I am calling is_unwrappable_parent multiple times. First in the iteration in order to skip, and second when finding the shallowest ancestor.

I do not like how I am repeatedly trimming several text nodes. This feels sluggish.

```
function filter_unwrappables_experimental(document) {
  const elements = document.querySelectorAll(UNWRAPPABLE_SELECTOR);
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(!is_unwrappable_parent(element)) {
      let shallowest = find_shallowest_unwrappable_ancestor(element);
      unwrap_element(element, shallowest);
    }
  }
}

function is_unwrappable_parent(element) {
  let result = element.matches(UNWRAPPABLE_SELECTOR);
  for(let node = element.firstChild; result && node;
    node = node.nextSibling) {
    if(node.nodeType === Node.ELEMENT_NODE) {
      if(!is_unwrappable_parent(node)) {
        result = false;
      }
    } else if(node.nodeType === Node.TEXT_NODE) {
      if(node.nodeValue.trim()) {
        result = false;
      }
    }
  }

  return result;
}

function find_shallowest_unwrappable_ancestor(element) {
  const body = element.ownerDocument.body;
  let shallowest = null;
  for(let node = element.parentNode; node && is_unwrappable_parent(node);
    node = node.parentNode) {
    if(node === body) {
      break;
    }
    shallowest = node;
  }
  return shallowest;
}
```

*/
