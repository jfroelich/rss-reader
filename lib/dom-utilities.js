

// NOTE: not currently in use
// Based on https://github.com/kangax/html-minifier/blob/gh-pages/src/htmlminifier.js
var BOOLEAN_ELEMENT_ATTRIBUTES = {
  allowfullscreen:1,async:1,autofocus:1,autoplay:1,checked:1,compact:1,
  controls:1,declare:1,'default':1,defaultchecked:1,defaultmuted:1,
  defaultselected:1,defer:1,disable:1,draggable:1,enabled:1,
  formnovalidate:1,hidden:1,indeterminate:1,inert:1,ismap:1,itemscope:1,
  loop:1,multiple:1,muted:1,nohref:1,noresize:1,noshade:1,novalidate:1,
  nowrap:1,open:1,pauseonexit:1,readonly:1,required:1,reversed:1,scoped:1,
  seamless:1,selected:1,sortable:1,spellcheck:1,translate:1,truespeed:1,
  typemustmatch:1,visible:1
};


/**
 * Returns true if an element is invisible according to our own very
 * simplified definition of visibility. We are really only going after some
 * common tactics on the web that are used by article authors to hide
 * elements in articles, not a true visibility test. Many websites do things
 * like use display:none for DHTML effects, advertising, etc
 *
 * TODO: learn more about HTMLElement.hidden
 *
 * NOTE: this does not consider offscreen elements (e.g. left:-100%;right:-100%;)
 * as invisible.
 *
 * NOTE: this does not consider dimensionless elements as invisible
 * (e.g. width:0px). Certain elements exhibit strange behaviors, like SPAN,
 * that report no width/height, even when the element contains non-empty
 * descendants and is therefore visible. We cannot do anything about the native
 * objects reporting 'incorrect' properties, so we cannot say an element is invisible
 * even though it has no dimensions.
 *
 * NOTE: this does not consider visibility of parents. Technically if parents are
 * invisible then this element is invisible.
 * NOTE: this does not consider if the element is in an overflow:none ancestor path and
 * happens to lay outside the visible rect
 * NOTE: this does not consider clipping.
 * NOTE: this does not consider scroll offset. In other words, the test is not about
 * whether the element is "currently" visible in this sense.
 * NOTE: this does not consider overlapping elements (e.g. higher z-index rectangle
 * that shares same coordinate space)
 * NOTE: this does not consider page visibility (e.g. in background tab)
 */
function isInvisibleElement(element) {
  return element.style.display == 'none' ||
    element.style.visibility == 'hidden' ||
    parseInt(element.style.opacity) === 0;
}



/**
 * Leaf like elements
 */
function isLeafLikeElement(element) {
  return element.matches('applet,audio,br,canvas,embed,frame,hr,iframe,img,object,video');
}


/**
 * Returns true if the node is a defined element that
 * is considered inline. Elements by default behave
 * according to either "display: block" or "display: inline". This can be changed
 * by CSS but we ignore that and use basic assumptions. In other words,
 * <p> is not inline and <span> is inline.
 *
 * Note: divs are technically inline, but are frequently used instead as blocks, so
 * divs are not considered inline.
 *
 * TODO: rename to something like isDefaultInlineElement
 * TODO: why are we checking if node is defined here?
 * TODO: why are we checking if node is an element? When is this ever called on
 * nodes and not elements?
 */
function isInlineElement(node) {
  return node && node.nodeType == Node.ELEMENT_NODE &&
    node.matches('a,abbr,acronym,b,bdo,big,blink,cite,code,dfn,'+
    'em,kbd,i,q,samp,small,span,strong,sub,sup,tt,var');
}



/**
 * Removes the element but retains its children. Useful for
 * removing 'wrapper' style elements like span/div/form. This is like
 * element.remove() but we keep the children.
 *
 * TODO: element.replace(element.childNodes) ???
 * See http://dom.spec.whatwg.org/#childnode.
 * It looks like Chrome supports ChildNode.remove but
 * does not support replace/after/before.
 */
function unwrapElement(element) {
  // We have to check element is defined since this is called every iteration
  // and a prior iteration may have somehow removed the element.

  // We check if parent element is defined just in case this is somehow
  // called on an element that was removed.
  // This function can work on detached nodes, but only if those nodes still have a
  // parentElement defined. The root element/node of a detached hierarchy does not
  // have a parentElement, but its children do have parents despite being deatched
  // from the main document.
  // NOTE: detachment can be tested easily, albeit inefficiently, by using
  // doc.body.contains(element).

  // NOTE: this function is not currently designed to perform well on
  // attached nodes, because it causes a reflow per move (per iteration
  // of the while loop below). It could be improved by moving the child
  // nodes into a DocumentFragment and then by replacing the original parent
  // with the fragment, which would cause fewer reflows. It could probably
  // be further improved by detaching the element itself first, then
  // building the fragment, and then inserting the fragment in the place
  // of the element (which means we need to store a reference to prev or
  // next sibling and also a reference to the parent element prior to
  // removing the element).
  // Given that calamine is, for now, intended to run on a
  // non-live DOM, this improvement is not important to do immediately.

  if(element && element.parentElement) {
    while(element.firstChild) {
      element.parentElement.insertBefore(element.firstChild, element);
    }

    element.remove();
    //element.parentElement.removeChild(element);
  }
}

// A simple helper for passing to iterators like forEach
function removeNode(node) {
  //if(node && node.parentNode) {
  //  node.parentNode.removeChild(node);
  //}

  // Note: text nodes, comment nodes, and elements
  // all appear to support this more concise method.
  if(node) {
    node.remove();
  }
}


/**
 * A simple helper to use forEach against traversal API.
 *
 * @param element - the root element, only nodes under the root are iterated. The
 * root element itself is not 'under' itself so it is not included in the iteration.
 * @param type - a type, corresponding to NodeFilter types
 * @param func - a function to apply to each node as it is iterated
 * @param filter - an optional filter function to pass to createNodeIterator
 */
function eachNode(element, type, func, filter) {
  var node, iterator = element.ownerDocument.createNodeIterator(element, type, filter);
  while(node = iterator.nextNode()) {
    func(node);
  }
}


/**
 * Returns the area of an image, in pixels. If the image's dimensions are
 * undefined, then returns undefined. If the image's dimensions are
 * greater than 800x600, then the area is clamped.
 */
function getImageArea(element) {
  // TODO: use offsetWidth and offsetHeight instead?
  if(isFinite(element.width) && isFinite(element.height)) {
    var area = element.width * element.height;

    // Clamp to 800x600
    if(area > 360000) {
      area = 360000;
    }

    return area;
  }
}