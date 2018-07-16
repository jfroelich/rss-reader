// Renames an element. This effectively changes the type of the element, so this
// is named after the verb for changing types (coerce/cast).
//
// Child nodes are retained unless the new type is a known void type. Event
// listeners are not retained. See https://stackoverflow.com/questions/15408394.
//
// This does not validate whether the new type is a valid child element of its
// parent, or whether placing the children in the new type produced well-formed
// html (other than for void elements).
//
// @param element {Element} the element to change
// @param new_name {String} the name of the element's new type
// @param copy_attributes {Boolean} optional, if true then attributes are
// maintained, defaults to true.
// @throws {Error} if the input element is not an element
// @throws {Error} if the new name seems invalid
// @return returns the new element that replaced the old one
export function coerce_element(element, new_name, copy_attributes = true) {
  if (!(element instanceof Element)) {
    throw new TypeError('element is not an Element');
  }

  // createElement is very forgiving regarding a new element's name. For
  // example, createElement(null) creates an element named "null". This is
  // misleading.
  if (!is_valid_element_name(new_name)) {
    throw new TypeError('Invalid new name ' + new_name);
  }

  // Treat attempting to rename an element to the same name as a noop. I've
  // decided to allow this for caller convenience as opposed to throwing an
  // error. Assume the document is html-flagged and therefore that localName
  // returns a lowercase string. Note that unlike the success path this returns
  // the original input, not a new element.
  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  // Treat attempting to rename an orphaned element as a noop. The caller is not
  // required to guarantee parent for reasons of convenience. We need the parent
  // in order to retain element position in the dom.
  const parent_element = element.parentNode;
  if (!parent_element) {
    return element;
  }

  // Before detaching, cache a reference to the preceding node so we can use it
  // for positioning the new element after it.
  const next_sibling = element.nextSibling;

  // Detach the existing node prior to performing other dom operations so that
  // later operations take place on a detached node, so that the least amount of
  // live dom operations are made. Implicitly this sets element.parentNode and
  // element.nextSibling to undefined.
  element.remove();

  // In DOM parlance, removing a node distinguishes between a change of
  // ownership and detachment. A change of ownership occurs when a node is moved
  // from one document to another document (the destination document is said to
  // adopt the node). Detachment retains ownership, but unlinks the node from
  // its parent and siblings. It is impossible to have an unowned node, the only
  // way to truly remove the node is to re-attach it to another document. Which
  // we will avoid. Therefore, element.ownerDocument is not affected by
  // element.remove(). Therefore, unlike element.parentNode or
  // element.nextSibling, there is no need to cache element.ownerDocument prior
  // to calling element.remove() in order to use element.ownerDocument after
  // calling element.remove().

  // Additionally, there is no point to removing a node if planning on changing
  // ownership. Any function that can change ownership such as insertBefore or
  // appendChild will implicitly do adoption, which implicitly involves a
  // removal step. All calling element.remove beforehand does in that situation
  // is make the removal explicit. This is not useful. So the fact that
  // element.remove() was called should signal no adoption.

  // XSS: Create a new element using the document in which the existing element
  // resides, not the document executing this function, so as to prevent the
  // ability to modify this script's behavior.
  // PERF: Create a new element using the document in which the existing element
  // resides, otherwise this triggers cross-document node adoption.

  const new_element = element.ownerDocument.createElement(new_name);

  if (copy_attributes) {
    copy_element_attributes(element, new_element);
  }

  if (!is_void_element(new_element)) {
    move_child_nodes(element, new_element);
  }

  // If the nextSibling parameter to insertBefore is undefined then insertBefore
  // simply appends (it basically devolves into appendChild). This has the
  // advantage over appendChild of not needing to explicitly check if next
  // sibling is defined.
  return parent_element.insertBefore(new_element, next_sibling);
}

// TODO: revisit using document fragment to see if it speeds this up?

// Move child nodes from src to destination, maintaining order. Child nodes are
// appended after any existing nodes in the destination. For better performance,
// the src element should be detached beforehand.
// NOTE: from an old benchmark, getting and setting innerHTML is substantially
// slower than this
function move_child_nodes(from_element, to_element) {
  // If this loop looks confusing at first, it is because appendChild moves the
  // node, which causes firstChild to then point to the next node.
  let node = from_element.firstChild;
  while (node) {
    to_element.appendChild(node);
    node = from_element.firstChild;
  }
}

// See https://html.spec.whatwg.org/multipage/syntax.html#void-elements. This is
// a set, but given the small size, it is better to use a simple array.
const void_elements = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
];

// Returns whether an element is a void element. This assumes
// element.ownerDocument is implicitly flagged as html so that localName yields
// the normalized name which is in lowercase. For now I'd rather make the
// assumption and let errors happen than incur the cost of calling toLowerCase.
export function is_void_element(element) {
  return void_elements.includes(element.localName);
}

// Returns true if the given name is a valid name for an element. This only does
// minimal validation and may yield false positives. This function is defensive
// so it can easily be asserted against.
// TODO: research what characters are allowed in an element's name
function is_valid_element_name(value) {
  return typeof value === 'string' && value.length && !value.includes(' ');
}

// Copies the attributes of an element to another element. Overwrites any
// existing attributes in the other element. Notably this uses getAttributeNames
// in preference to element.attributes due to performance issues, and to allow
// unencumbered use of the for-of syntax (I had issues with NamedNodeMap).
export function copy_element_attributes(from_element, to_element) {
  const names = from_element.getAttributeNames();
  for (const name of names) {
    const value = from_element.getAttribute(name);
    to_element.setAttribute(name, value);
  }
}
