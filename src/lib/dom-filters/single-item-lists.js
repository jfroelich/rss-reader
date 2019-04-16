import unwrapElement from '/src/lib/unwrap-element.js';

// Scan the document for lists that contain either no elements or only a single list item element.
// If such a list is found, then unwrap the list by moving its single item's content into the
// position before the list element itself and then removing the list element.
export default function filter(document) {
  const listElements = document.querySelectorAll('ul, ol, dl');
  for (const list of listElements) {
    if (isEmptyOrSingleItemList(list)) {
      unwrapElement(list);
    }
  }
}

// Returns whether the list is empty or has only one child list item element. A list is empty if
// it either has no nodes at all, or has child nodes but no elements. The meaning of empty here
// is only for purposes of deciding whether to unwrap. This could be more terse but I find the logic
// to get confusing when written that way. This is simple to maintain.
function isEmptyOrSingleItemList(list) {
  // The list is empty if it has no child nodes. firstChild is undefined in that case.
  if (!list.firstChild) {
    return true;
  }

  // firstElementChild is undefined when there are no child elements. If the list has child nodes,
  // but not child elements, then consider the list virtually empty.
  if (!list.firstElementChild) {
    return true;
  }

  // The list has one or more child nodes and elements. If the first element has a sibling element
  // then the list is not a singleton.
  if (list.firstElementChild.nextElementSibling) {
    return false;
  }

  // There is exactly one child element of the list. If the one child element is a list item
  // element then the list is a singleton. If the one child element is not a list item element, then
  // it is some intermediate kind of element (like a nested form), so we cannot be sure, so treat
  // as not singleton.
  //
  // NOTE: we do not care about mismatch between definition lists and ordered/unordered lists such
  // as (e.g. <ol><dd/></ol>). In general, this is just harmless author error that we tolerate.
  const listItemElementNames = ['dd', 'dt', 'li'];
  return listItemElementNames.includes(list.firstElementChild.localName);
}
