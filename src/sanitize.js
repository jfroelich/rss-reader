// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

(function(exports) {
'use strict';

var filter = Array.prototype.filter;
var forEach = Array.prototype.forEach;
var slice = Array.prototype.slice;

/**
 * Inner utility function for removing elements. I wanted to
 * be able to pass Element.prototype.remove but could not get it
 * to work.
 */
function remove(element) {
  element.remove();
}

/**
 * Rudimentary replacement of alternative forms of whitespace with normal
 * space character. This is helpful when trimming or getting text length
 * less whitespace.
 */
function canonicalizeSpaces(doc) {
  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var node = it.nextNode();
  while(node) {
    node.nodeValue = node.nodeValue.replace(/&nbsp;/ig, ' ');
    node.nodeValue = node.nodeValue.replace(/&#xA0;/ig, ' ');
    node.nodeValue = node.nodeValue.replace(/&#160;/g, ' ');
    node = it.nextNode();
  }
}

var SELECTOR_LEAF_LIKE = ['area', 'audio', 'br', 'canvas', 'col',
  'hr', 'img', 'source', 'svg', 'track', 'video'].join(',');

/**
 * Returns true if an element is 'empty'
 */
function isEmptyLike(element) {
  // An element is not empty if it has one or more child nodes
  if(element.firstChild) {
    return false;
  }

  // Certain elements that do have child nodes are still considered empty
  return !element.matches(SELECTOR_LEAF_LIKE);
}

/**
 * Elements which default to display:inline or inline-block
 * NOTE: <div> is treated as an exception and not considered inline
 */
var INLINE_ELEMENTS = new Set(['a','abbr', 'acronym', 'address',
  'b', 'bdi', 'bdo', 'blink','cite', 'code', 'data', 'del',
  'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'mark', 'map',
  'meter', 'q', 'rp', 'rt', 'samp', 'small', 'span', 'strike',
  'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var'
]);

function isInline(element) {
  // Element may be undefined since the caller does not check
  // if node.nextSibling or node.previousSibling are defined
  // before the call.
  // TODO: maybe this is responsibility of caller
  if(!element) {
    return false;
  }

  // This condition definitely happens, not exactly sure how or why
  // TODO: does this mean it is inline? should this be returning true?
  if(element.nodeType != Node.ELEMENT_NODE) {
    return false;
  }

  return INLINE_ELEMENTS.has(element.localName);
}

/**
 * Remove all empty-like elements from the document. If removing
 * an element would change the state of the element's parent to also
 * meet the empty-like criteria, then the parent is also removed, and
 * so forth, up the hierarchy, but stopping before doc.body.
 *
 * TODO: This needs a lot of cleanup
 */
function removeEmptyElements(doc) {

  // TODO: there is a specific edge case not being handled
  // where certain elements, e.g. anchors, that do not contain
  // any child nodes, should be considered empty. And this must
  // be recursive as well, up the tree.
  // In the case of <ul><li><a></a></li></ul>, the result should
  // be that the entire subtree is removed.
  // Because this case is not currently handled, and because we
  // remove other nodes, this leads to some funny looking junk
  // areas of content (e.g. a list of empty bullet points)
  // This gets trickier because the logic, in the current impl,
  // has to be in a couple places. In isEmptyLike, an anchor without
  // a firstChild should be considered empty. That should be handled
  // right now but for some odd reason it is not. Then once any element
  // is removed and we check its parent, its parent should go through
  // the same logic, which does not seem to happen, even though
  // the logic is plainly there to do that.

  // TODO: removes should happen only once on the shallowest
  // parent. If this were called on a live doc we would be causing
  // several unecessary reflows. For example, in the case of
  // <div><p></p><p></p></div>, there are 3 remove operations,
  // when only 1 needed to occur. To do this, this needs
  // to be fundamentally refactored. Removes should not occur
  // on the first pass over the elements. This, btw, would remove the
  // ugliness of using a map function with a side effect. Instead, start by
  // identifying all of the empty leaves. Then, for each leaf, traverse
  // upwards to find the actual element to remove. Be cautious
  // about simply checking that parent.childElementCount == 1 to find
  // a removable parent because it is false in the case that two
  // or more empty-leaves share the same parent. The criteria instead is
  // that a parent is removable if all of its children are removable.
  // So we need to go up 1, then query all direct children. But that is
  // kind of redundant since we already identified the children, so that
  // still might need improvement.
  var elements = doc.body.getElementsByTagName('*');
  var emptyLikeElements = filter.call(elements, isEmptyLike);
  // TODO: just add children that should be removed to the stack insead of
  // removing them and adding their parents to the stack.
  // Remove all the empty children and shove all the parents on the stack
  var parents = emptyLikeElements.map(function (element) {
    var parentElement = element.parentElement;
    element.remove();
    return parentElement;
  });

  // Avoid removing the body element
  var stack = parents.filter(function (element) {
    return element != doc.body;
  });

  var parent, grandParent;

  while(stack.length) {
    parent = stack.pop();

    if(parent.firstChild) {
      // There are other nodes in the parent after
      // the child was removed,
      // so do not remove the parent.
      continue;
    }

    // Grab a reference to the grand parent before removal
    // because after removal it is undefined
    grandParent = parent.parentElement;

    // Detach
    parent.remove();

    // If there was no grand parent (how would that ever happen?)
    // or the grand parent is the root, then do not add the new
    // grand parent to the stack
    if(!grandParent || grandParent == doc.body) {
      continue;
    }

    stack.push(grandParent);
  }
}

/**
 * Technically a node without a node value should be deleted. Here
 * trim node function may set node value to '', so the node still exists,
 * but I now want to remove it. So this iterates over the text nodes
 * and removes those.
 */
function removeEmptyNodes(doc) {
  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var node;
  while(node = it.nextNode()) {
    if(!node.nodeValue) {
      node.remove();
    }
  }
}

/**
 * Removes all attributes from an element except those in the given Set of
 * allowed attributes
 */
function removeAttributes(allowedAttributes, element) {
  var attributes = element.attributes;
  var name;
  var index = attributes.length;

  // We iterate in reverse due to issues with mutation during iteration.
  // attributes is a live node collection whose indices are updated every
  // time an attribute is changed.
  while(index--) {
    name = attributes[index].name;
    if(!allowedAttributes.has(name)) {
      element.removeAttribute(name);
    }
  }
}

var DEFAULT_ALLOWED_ATTRIBUTES = new Set(['href','src']);

function removeDescendantAttributes(allowedAttributes, element) {
  removeAttributes(allowedAttributes, element);
  var descendants = element.getElementsByTagName('*');
  forEach.call(descendants, removeAttributes.bind(this, allowedAttributes));
}


// TODO: this should be a Set
var BLACKLISTED_ELEMENTS = [

  // Removing head first avoids the need to remove several other tags
  'head',

  'applet', 'base', 'basefont', 'bgsound', 'button', 'command',
  'datalist', 'dialog', 'embed', 'fieldset', 'frameset',
  'html', 'iframe', 'input', 'isindex', 'math', 'link', 'menu',
  'menuitem',
  'meta', 'object','optgroup',  'output', 'param', 'progress',
  'script', 'spacer', 'style', 'textarea', 'title', 'xmp',

  // Remove after 'select' to reduce operations
  'select',
  'option'
];

/**
 * Removes all elements in the black list
 */
function removeBlacklistedElements(doc) {
  var root = doc.body;

  BLACKLISTED_ELEMENTS.forEach(function(name) {
    var element = root.querySelector(name);
    while(element) {
      // console.log('removing %o', element);
      element.remove();
      element = root.querySelector(name);
    }
  });

  // Non-standard elements seen in the wild. These cannot be passed
  // as selectors to querySelectorAll
  var gPlusOnes = root.getElementsByTagName('g:plusone');
  for(var i = 0, len = gPlusOnes.length; i < len; i++) {
    // NOTE: gebtn is live so one removal could affect others
    // so we have to check if defined
    // TODO: check if not detached
    if(gPlusOnes[i]) {
      gPlusOnes[i].remove();
    }
  }

  var fbComments = root.getElementsByTagName('fb:comments');
  for(var i = 0, len = fbComments.length; i < len; i++) {
    if(fbComments[i]) {
      // TODO: check if not detached
      fbComments[i].remove();
    }
  }
}

/**
 * Remove all comment nodes
 */
function removeComments(doc) {
  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_COMMENT);
  var node;
  while(node = it.nextNode()) {
    node.remove();
  }
}

/**
 * Removes script anchors
 * TODO: replace href and leave it in? or remove it?
 * NOTE: does not handle nested anchors correctly, because remove could lead
 * to later removal of children of detached ancestors
 */
function removeJavascriptAnchors(root) {
  var anchors = root.querySelectorAll('a[href]');
  var scriptAnchors = filter.call(anchors, isScriptAnchor);
  scriptAnchors.forEach(remove);
}

/**
 * Returns whether the anchor's href looks like it contains inline script.
 */
function isScriptAnchor(anchor) {
  var href = anchor.getAttribute('href');
  // TODO: allow for whitespace   /^\s*javascript\s*:/i
  return /^javascript:/i.test(href);
}

/**
 * Returns whether an element is invisible
 */
function isInvisible(element) {

  // noscript and noembed are exceptions to the general rules. We always
  // consider them visible regardless of other features.
  if(element.localName == 'noscript' || element.localName == 'noembed') {
    return false;
  }

  // TODO: this is alarmingly slow. My best guess is that
  // element.style is lazily computed, or that opacity
  // calc is slow
  // Look at how jquery implemented :hidden? Maybe it is fast?
  // exampleofhowjquerydoesit( elem ) {
    // NOTE: they also check display === 'none'
  //  return elem.offsetWidth <= 0 || elem.offsetHeight <= 0;
  //};

  // TODO: element.offsetWidth < 1 || element.offsetHeight < 1; ??
  // saw that somewhere, need to read up on offset props again.
  // The thing is, are offsetWidth and offsetHeight properties set
  // when parsing via the set innerHTML trick for foreign, inert
  // html documents?

  var style = element.style;
  if(style.display === 'none') {
    return true;
  }
  if(style.visibility === 'hidden' || style.visibility === 'collapse') {
    return true;
  }

  var opacity = parseFloat(style.opacity);
  // We don't actually require it be 0, just too transparent to see
  return opacity < 0.3;
}

function removeInvisibleElements(doc) {
  var elements = doc.body.getElementsByTagName('*');
  var invisibles = filter.call(elements, isInvisible);
  invisibles.forEach(remove);
}

function isTracerImage(image) {
  var width = image.getAttribute('width');
  var height = image.getAttribute('height');

  // Rather than inspect the source url against a blacklist of known
  // tracking domains, we use the simpler tactic of targeting
  // the common signature of tracer images, a 1x1 image.

  // We actually also remove any 1xN or Nx1 images because they are generally
  // not helpful (e.g. virtual borders, hrs)

  // The fact that an image will not be visible in the page does not prevent
  // Chrome from trying to fetch it, which is abused as a tracking device
  // So we also check for zero widths
  return width === '0' || width === '0px' || width === '1' ||
    height === '1px' || height === '1' || image.width === 0 ||
    image.width === 1 || image.height === 0 || image.height === 1;
}

function removeTracerImages(doc) {
  var images = doc.body.getElementsByTagName('img');
  filter.call(images, isTracerImage).forEach(remove);
}

function isSourcelessImage(image) {
  // Access by attribute, not by property, since the browser substitutes
  // in the base url if accessing by property.

  var source = image.getAttribute('src');
  return !(source && source.trim());
}

/**
 * Remove all images that do not have a src attribute
 */
function removeSourcelessImages(doc) {
  var images = doc.body.getElementsByTagName('img');
  var sourcelessImages = filter.call(images, isSourcelessImage);
  sourcelessImages.forEach(remove);
}

/**
 * Unwraps noscript elements
 * Testing example:
 * http://fortune.com/2014/09/09/apple-event-overshadows-bad-news-snapchat-tinder/
 */
function unwrapNoscripts(doc) {

  var noscripts = doc.body.getElementsByTagName('noscript');
  forEach.call(noscripts, unwrap);
}

/**
 * Unwrap all noframes elements.
 * See http://www.miracleas.com/BAARF/ as testing example.
 */
function unwrapNoframes(doc) {

  var noframes = doc.body.getElementsByTagName('noframes');
  forEach.call(noframes, unwrap);
}

function isTrimmableElement(element) {
  var name;
  if(!element) return false;
  if(element.nodeType != Node.ELEMENT_NODE) return false;
  name = element.localName;
  if(name == 'br') return true;
  if(name == 'hr') return true;
  if(name == 'p' && !element.firstChild) return true;
  return false;
}

function trimElement(element) {
  var node = element.firstChild;
  var sibling;
  while(isTrimmableElement(node)) {
    sibling = node.nextSibling;
    node.remove();
    node = sibling;
  }
  node = element.lastChild;
  while(isTrimmableElement(node)) {
    sibling = node.previousSibling;
    node.remove();
    node = sibling;
  }
}

function trimNodes(doc) {

  var WHITESPACE_SENSITIVE = 'code, code *, pre, pre *, ruby, ruby *, textarea,' +
    ' textarea *, xmp, xmp *';
  var elements = doc.body.querySelectorAll(WHITESPACE_SENSITIVE);
  var preformatted = new Set(slice.call(elements));

  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var node;
  while(node = it.nextNode()) {
    if(preformatted.has(node.parentElement)) {
      continue;
    }

    if(isInline(node.previousSibling)) {
      if(!isInline(node.nextSibling)) {
        node.nodeValue = node.nodeValue.trimRight();
      }
    } else if(isInline(node.nextSibling)) {
      node.nodeValue = node.nodeValue.trimLeft();
    } else {
      node.nodeValue = node.nodeValue.trim();
    }
  }
}

/**
 * A function that should be a part of the DOM itself but unfortunately is not.
 * This replaces the element with its children.
 *
 * This is not optimized to be called on a live document. This causes a reflow
 * per move.
 */
function unwrap(element) {
  // Cache parent lookup
  var parent = element.parentElement;

  // Avoid issues with documentElement or detached elements
  if(!parent) {
    return;
  }

  // Move each child of the element to the position preceding the element in
  // the parent's node list, maintaining child order.
  while(element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  // Now the element is empty so detach it
  element.remove();
}

/**
 * Extremely simple <br>2<p> transformation. This does not quite work
 * like I prefer but it sort of does the job. It turns out to be really
 * complicated to make it work
 */
function transformBreaks(doc) {
  var br = doc.body.querySelector('br');
  while(br) {
    br.parentNode.replaceChild(doc.createElement('p'), br);
    br = doc.body.querySelector('br');
  }
}

/**
 * Unwraps certain descendant elements of the root element
 */
function unwrapDescendants(rootElement) {

  // NOTE: this performs extremely poorly when dealing with a large
  // number of elements. For example, it took ~20 secs on
  // https://www.omniref.com/ruby/2.2.0.preview1/symbols/Object
  // It is the querySelector call
  // So, tentatively, we are using an upper bound of 3000 iterations

  // Added 'tt' (teletype) element. It is obsolete but I prefer such articles
  // not to be rendered in fixed-width font.

  var unwrappables = [
    'article','big','blink','body','center','colgroup','data','details',
    'div','font','footer','form','header','help','hgroup', 'ilayer', 'insert',
    'label','layer','legend', 'main','marquee', 'meter', 'multicol','nobr',
    'noembed','noscript','plaintext','section', 'small','span','tbody',
    'tfoot','thead', 'tt'
  ].join(',');

  // We use querySelector and do one at element at a time in order to avoid
  // unwrapping elements that, as a result of a previous iteration, now exist
  // in a detached axis. The alternative would be to check whether the root
  // element still contains each element before unwrapping it.

  var element = rootElement.querySelector(unwrappables);
  var numIterations = 0;
  while(element && (numIterations < 3000)) {
    unwrap(element);
    element = rootElement.querySelector(unwrappables);
    numIterations++;
  }

  if(numIterations == 3000) {
    console.warn('Did not fully unwrap descendants, 3000+ iterations');
  }

  // We do a second pass for the special situation of anchors that do
  // not have an href value.

  // TODO: what about if they have 'name' attribute?
  // TODO: maybe this should be a separate function?

  var anchors = rootElement.getElementsByTagName('a');
  var nominalAnchors = filter.call(anchors, function(anchor) {
    var href = anchor.getAttribute('href');

    if(href) {
      if(href.trim()) {
        return false;
      } else {
        return true;
       }
    } else {
      return true;
    }

  });

  nominalAnchors.forEach(unwrap);
}

exports.DEFAULT_ALLOWED_ATTRIBUTES = DEFAULT_ALLOWED_ATTRIBUTES;
exports.canonicalizeSpaces = canonicalizeSpaces;
exports.removeDescendantAttributes = removeDescendantAttributes;
exports.removeBlacklistedElements = removeBlacklistedElements;
exports.removeComments = removeComments;
exports.removeEmptyNodes = removeEmptyNodes;
exports.removeEmptyElements = removeEmptyElements;
exports.removeJavascriptAnchors = removeJavascriptAnchors;
exports.removeInvisibleElements = removeInvisibleElements;
exports.removeTracerImages = removeTracerImages;
exports.removeSourcelessImages = removeSourcelessImages;
exports.unwrapNoscripts = unwrapNoscripts;
exports.unwrapNoframes = unwrapNoframes;
exports.trimElement = trimElement;
exports.trimNodes = trimNodes;
exports.transformBreaks = transformBreaks;
exports.unwrapDescendants = unwrapDescendants;

}(lucu));
