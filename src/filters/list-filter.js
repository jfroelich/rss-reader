import assert from "/src/utils/assert.js";

// Filters certain list elements from document content


// TODO: restrict children of list to proper child type. E.g. only allow li or form within ul/ol,
// and dd/dt/form within dl. Do some type of transform like move such items to within a new child

export default function filterDocument(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const ancestor = doc.body;
  const lists = ancestor.querySelectorAll('ul, ol, dl');

  // TODO: maybe this empty checking should be moved into the leafFilterIsLeaf logic as a special
  // case for list elements. That way it will be recursive. But this does a moving of children where
  // as the leaf code just removes. So that would also entail changing the meaning of leaf filtering
  // from filter to transform.
  for(const list of lists) {
    if(isEmptyList(list)) {
      removeEmptyList(list);
    }
  }

  for(const list of lists) {
    unwrapSingleItemList(list);
  }
}

// Return true if list is 'empty'
function isEmptyList(list) {
  // Return true if the list has no child nodes. This is redundant with leaf filtering but I think
  // it is ok and prefer to not make assumptions about composition with other filters
  if(!list.firstChild) {
    return true;
  }

  const item = list.firstElementChild;

  // If the list has no elements, only nodes, then return true.
  if(!item) {
    return true;
  }

  // TODO: this check is too simple, because it ignores tolerable intermediate elements, such as
  // <ul><form><li/><li/></form></ul>. That is not empty. And I believe it is still well-formed.

  // If this is the only element in the list, then check if it is empty.
  // NOTE: the first child check is admittedly simplistic and easily defeated even just by a
  // whitespace text node. But the goal I think is not to be perfect and just grab low hanging
  // fruit.
  if(!item.nextElementSibling && !item.firstChild) {
    return true;
  }

  // The list is not empty
  return false;
}

function removeEmptyList(list) {
  const doc = list.ownerDocument;

  // Add leading padding
  if(list.previousSibling &&
    list.previousSibling.nodeType === Node.TEXT_NODE) {
    list.parentNode.insertBefore(doc.createTextNode(' '), list);
  }

  const firstChild = list.firstChild;

  // Move any child nodes (there may be none). As each first child is moved, the next child becomes
  // the first child.
  for(let node = firstChild; node; node = list.firstChild) {
    list.parentNode.insertBefore(node, list);
  }

  // Add trailing padding if needed. Also check if there were children, so as to not add padding on
  // top of the leading padding when there is no need.
  if(firstChild && list.nextSibling &&
    list.nextSibling.nodeType === Node.TEXT_NODE) {
    list.parentNode.insertBefore(doc.createTextNode(' '), list);
  }

  list.remove();
}

// Unwraps single item or empty list elements
function unwrapSingleItemList(list) {

  const listParent = list.parentNode;
  if(!listParent) {
    return;
  }

  const doc = list.ownerDocument;
  const item = list.firstElementChild;

  // If the list has no child elements then just remove. This is overly simple and could lead to
  // data loss, but it is based on the assumption that empty lists are properly handled in the
  // first place earlier. Basically, this should never happen and should almost be an assert?
  if(!item) {
    list.remove();
    return;
  }

  // If the list has more than one child element then leave the list as is
  if(item.nextElementSibling) {
    return;
  }

  // If the list's only child element isn't one of the correct types, ignore it
  const listItemNames = {li: 0, dt: 0, dd: 0};
  if(!(item.localName in listItemNames)) {
    return;
  }

  // If the list has one child element of the correct type, and that child element has no inner
  // content, then remove the list. This will also remove any non-element nodes within the list
  // outside of the child element.
  if(!item.firstChild) {
    // If removing the list, avoid the possible merging of adjacent text nodes
    if(list.previousSibling &&
      list.previousSibling.nodeType === Node.TEXT_NODE &&
      list.nextSibling &&
      list.nextSibling.nodeType === Node.TEXT_NODE) {

      listParent.replaceChild(doc.createTextNode(' '), list);

    } else {
      list.remove();
    }

    return;
  }

  // The list has one child element with one or more child nodes. Move the child nodes to before the
  // list and then remove iterator.

  // Add leading padding
  if(list.previousSibling &&
    list.previousSibling.nodeType === Node.TEXT_NODE &&
    item.firstChild &&
    item.firstChild.nodeType === Node.TEXT_NODE) {

    listParent.insertBefore(doc.createTextNode(' '), list);
  }

  // Move the children of the item to before the list, maintainin order
  for(let node = item.firstChild; node; node = item.firstChild) {
    listParent.insertBefore(node, list);
  }

  // Add trailing padding
  if(list.nextSibling &&
    list.nextSibling.nodeType === Node.TEXT_NODE &&
    list.previousSibling &&
    list.previousSibling.nodeType === Node.TEXT_NODE) {

    listParent.insertBefore(doc.createTextNode(' '), list);
  }

  list.remove();
}
