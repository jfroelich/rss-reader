// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: deprecate filter, forEach, etc. Use lucu.array.fns instead

'use strict';

var lucu = lucu || {};
lucu.element = {};

lucu.element.filter = function(list, fn) {
  if(!list) {
    return [];
  }

  return Array.prototype.filter.call(list, fn);
};

lucu.element.forEach = function(list, fn) {

  if(!list) {
    return;
  }

  return Array.prototype.forEach.call(list, fn);
};

// Map a function over a HTMLCollection or NodeList
lucu.element.map = function(list, fn) {

  // This defensive guard lets us avoid the null check
  // in the calling context, which is typical because the list
  // is typically generated by getElementsByTagName or querySelectorAll
  // which has at times (for unknown reasons) returned undefined/null.
  if(!list) {
    return [];
  }

  return Array.prototype.map.call(list, fn);
};



// NOTE: not currently in use. Keeping around as a note in the event I want to do
// minimization as one of the transformations on remote html data.
// Based on https://github.com/kangax/html-minifier/blob/gh-pages/src/htmlminifier.js
lucu.element.BOOLEAN_ATTRIBUTES = {
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
lucu.element.getTextOrAttribute = function(rootElement, selectors, attribute) {
  var getter;
  if(attribute) {
    getter = lucu.element.getAttribute.bind(this, attribute);
  } else {
    getter = lucu.element.getTextContent;
  }

  // NOTE: using a raw loop because nothing in the native iteration API
  // fits because of the need to use side effects and the need short
  // circuit

  for(var i = 0, temp; i < selectors.length; i++) {
    temp = rootElement.querySelector(selectors[i]);
    if(!temp) continue;
    temp = getter(temp);
    if(!temp) continue;
    temp = temp.trim();
    if(!temp) continue;
    return temp;
  }
};

// Wraps element.getAttribute. Used for partial on attribute (due to arg order)
// instead of just HTMLElement.prototype.getAttribute
lucu.element.getAttribute = function(attribute, element) {
  return element.getAttribute(attribute);
};

lucu.element.getTextContent = function(element) {
  return element.textContent;
};

/**
 * Returns true if an element is invisible according to our own very
 * simplified definition of visibility. We are really only going after some
 * common tactics like using display:none for progressive loading or SEO
 */
lucu.element.isInvisible = function(element) {



  // NOTE: element.offsetWidth < 1 || element.offsetHeight < 1; ??
  // saw that somewhere, need to read up on offset props again

  return element.style.display == 'none' ||
      element.style.visibility == 'hidden' ||
      parseInt(element.style.opacity) === 0;
};

/**
 * Leaf like elements
 */
lucu.element.isLeafLike = function(element) {
  return element.matches('applet,audio,br,canvas,embed,frame,hr,iframe,img,object,video');
};

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
lucu.element.isInline = function(node) {
  return node && node.nodeType == Node.ELEMENT_NODE &&
    node.matches('a,abbr,acronym,b,bdo,big,blink,cite,code,dfn,'+
    'em,kbd,i,q,samp,small,span,strong,sub,sup,tt,var');
};

/**
 * Removes the element but retains its children.
 */
lucu.element.unwrap = function(element) {
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
};
