// html list filtering lib

// Dependencies:
// assert.js
// transform-helpers.js // for insert_children_before

// TODO: use html_list prefix for globals

function unwrap_single_item_lists(ancestor_element) {
  ASSERT(ancestor_element);

  const list_elements = ancestor_element.querySelectorAll('ul, ol, dl');
  for(const list_element of list_elements)
    unwrap_single_item_list(ancestor_element, list_element);
}

// Unwraps single item or empty list elements
// TODO: I do not need the parameter ancestor_element, I can use
// list.ownerDocument. The parameter is probably still here just as an artifact
// of some previous approach. It looks like there is only reference to it
// within the function.
function unwrap_single_item_list(ancestor_element, list) {

  // TODO: inline
  function node_is_text(node) {
    return node && node.nodeType === Node.TEXT_NODE;
  }


  const list_parent = list.parentNode;
  if(!list_parent)
    return;
  const doc = ancestor_element.ownerDocument;
  const item = list.firstElementChild;

  // If the list has no child elements then move its child nodes out of the
  // list and remove iterator
  // TODO: this is unexpected, probably should be separate function
  if(!item) {
    // If iterator is just <list>...<item/>...<list> then remove
    if(!list.firstChild) {
      list.remove();
      return;
    }
    // The list has no child elements, but the list has one or more child
    // nodes. Move the nodes to before the list. Add padding if needed.
    if(node_is_text(list.previousSibling))
      list_parent.insertBefore(doc.createTextNode(' '), list);
    for(let node = list.firstChild; node; node = list.firstChild)
      list_parent.insertBefore(node, list);
    if(node_is_text(list.nextSibling))
      list_parent.insertBefore(doc.createTextNode(' '), list);
    list.remove();
    return;
  }

  // If the list has more than one child element then leave the list as is
  if(item.nextElementSibling)
    return;
  // If the list's only child element isn't one of the correct types, ignore it
  const list_item_names = {'li': 0, 'dt': 0, 'dd': 0};
  if(!(item.localName in list_item_names))
    return;

  // If the list has one child element of the correct type, and that child
  // element has no inner content, then remove the list. This will also remove
  // any non-element nodes within the list outside of the child element.
  if(!item.firstChild) {
    // If removing the list, avoid the possible merging of adjacent text nodes
    if(node_is_text(list.previousSibling) && node_is_text(list.nextSibling))
      list_parent.replaceChild(doc.createTextNode(' '), list);
    else
      list.remove();
    return;
  }

  // The list has one child element with one or more child nodes. Move the
  // child nodes to before the list and then remove iterator. Add padding.
  if(node_is_text(list.previousSibling) && node_is_text(item.firstChild))
    list_parent.insertBefore(doc.createTextNode(' '), list);
  insert_children_before(item, list);
  if(node_is_text(list.nextSibling) && node_is_text(list.previousSibling))
    list_parent.insertBefore(doc.createTextNode(' '), list);
  list.remove();
}
