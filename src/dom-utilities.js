// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// NOTE: not currently in use. Keeping around as a note in the event I want to do
// minimization as one of the transformations on remote html data.
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
 * Gets the textContent of a specific element or the value of a specific
 * attribute in the element. The value of the attribute is retrieved if an
 * attribute is specified. Returns undefined if nothing matches or
 * the value for anything that did match was empty.
 *
 * Reasons why this function is useful:
 * 1) Searching for a comma separated list of selectors works in document
 * order, regardless of the order of the selectors. By using an array
 * of separate selectors, we can prioritize selector order over
 * document order in the specification.
 * 2) We sometimes want to get the value of an attribute instead of
 * the text content. Searching for the attribute involves nearly all the
 * same steps as searching for the element.
 * 3) We want to only consider non-empty values as matching.
 * querySelectorAll stops once the element matches, and does not let
 * us compose additional concise and exact conditions on the textContent
 * value or attribute value. So this function enables us to fallback to later
 * selectors by merging in the non-empty-after-trimming condition.
 * 4) We want short circuiting. querySelectorAll walks the entire
 * document every time, which is a waste.
 */
function getElementTextOrAttribute(rootElement, selectors, attribute) {

  // TODO: instead of defining our own functions, use
  // something like HTMLElement.prototype.getAttribute instead of the
  // fromAttribute function.
  // TODO: define the getText function externally.

  // Which value is accessed is loop invariant.
  var accessText = attribute ? function fromAttribute(element) {
    return element.getAttribute(attribute);
  } : function fromTextContent(element) {
    return element.textContent;
  };

  // NOTE: using a raw loop because nothing in the native iteration API
  // fits because of the need to use side effects and the need short
  // circuit

  for(var i = 0, temp; i < selectors.length; i++) {
    temp = rootElement.querySelector(selectors[i]);
    if(!temp) continue;
    temp = accessText(temp);
    if(!temp) continue;
    temp = temp.trim();
    if(!temp) continue;
    return temp;
  }
}

/**
 * Returns true if an element is invisible according to our own very
 * simplified definition of visibility. We are really only going after some
 * common tactics like using display:none for progressive loading or SEO
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
 * Removes the element but retains its children.
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

  if(element && element.parentElement) {
    while(element.firstChild) {
      element.parentElement.insertBefore(element.firstChild, element);
    }

    element.remove();
  }
}

// A simple helper for passing to iterators like forEach
function removeNode(node) {

  // This uses the new node.remove function instead of
  // node.parentNode.removeChild(node).

  if(node) {
    node.remove();
  }
}


// TODO: is there a native functional way to accomplish this?
function getNodeValue(node) {
  return node.nodeValue;
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
  var ownerDocument = element.ownerDocument;
  var iterator = ownerDocument.createNodeIterator(element, type, filter);
  var node;

  while(node = iterator.nextNode()) {
    func(node);
  }
}


// Depends on uri
function resolveAnchorElement(baseURI, anchorElement) {

  if(!baseURI)
    return;

  // Use the attribute to get the url, not the property, because
  // property access does not return the original value
  var sourceURL = (anchorElement.getAttribute('href') || '').trim();

  if(!sourceURL)
    return;

  // TODO: do not resolve certain schemes: mailto, javascript
  // calendar (caldav?), filesystem..? feed:???  This should
  // be a feature of the URI API but the URI API currently sucks
  // and is incomplete so we have to do the checks here.

  if(/^mailto:/.test(sourceURL)) {
    return;
  }

  if(/^javascript:/.test(sourceURL)) {
    return;
  }

  var sourceURI = lucu.uri.parse(sourceURL);

  // At this point we should have a resolvable URI. This is a simple
  // debugging check for learning about url resolution errors
  if(sourceURI.scheme) {
    if(sourceURI.scheme != 'http' && sourceURI.scheme != 'https') {
      console.warn('probable url resolution bug %s', sourceURL);
    }
  }

  var resolvedURL = lucu.uri.resolve(baseURI, sourceURI);

  if(resolvedURL == sourceURL)
    return;

  //console.debug('Changing anchor url from %s to %s', sourceURL, resolvedURL);

  // TODO: perhaps this function should be redesigned so that it can be
  // passed as a parameter to HTMLElement.prototype.setAttribute that was
  // bound to the element. This way it is less of a side-effect style function
  // At the same time it introduces more boilerplate into the calling context.

  anchorElement.setAttribute('href', resolvedURL);
}

/**
 * Fade an element in/out
 * Elements must have opacity defined as 0 or 1 for this to work
 *
 * TODO: this needs to be entirely refactored. it could be
 * greatly simplified, it could make fewer assumptions about the element's
 * state
 */
function fadeElement(element, duration, delay, callback) {

  if(element.style.display == 'none') {
    element.style.display = '';
    element.style.opacity = '0';
  }

  if(!element.style.opacity)
    element.style.opacity = element.style.display == 'none' ? '0' : '1';

  if(callback)
    element.addEventListener('webkitTransitionEnd', ended);

  // property duration function delay
  element.style.transition = 'opacity '+duration+'s ease '+delay+'s';
  element.style.opacity = element.style.opacity == '1' ? '0' : '1';

  function ended(event) {
    this.removeEventListener('webkitTransitionEnd', ended);
    if(callback)
      callback(element);
  }
}
