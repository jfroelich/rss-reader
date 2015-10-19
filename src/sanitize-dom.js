// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// DOM sanitize funtions
lucu.sanitize = {};

/**
 * Sanitizes a document, applying most of the other functions in this lib
 */
lucu.sanitize.sanitizeDocument = function(document) {
  'use strict';
  const ls = lucu.sanitize;

  ls.removeComments(document);
  ls.removeBlacklistedElements(document);
  ls.removeSourcelessImages(document);
  ls.removeTracerImages(document);
  ls.unwrapNoscripts(document);
  ls.unwrapNoframes(document);

  // Temp disabled during development
  // ls.removeInvisibleElements(document);

  ls.canonicalizeSpaces(document);
  lucu.trim.trimNodes(document);
  ls.removeEmptyNodes(document);
  ls.removeEmptyElements(document);

  const results = calamine.transform(document, {
    FILTER_NAMED_AXES: true,
    ANNOTATE: false
  });

  ls.removeJavascriptAnchors(results);
  ls.unwrapDescendants(results);

  ls.removeDescendantAttributes(ls.DEFAULT_ALLOWED_ATTRIBUTES, results);

  lucu.trim.trimDocument(results);
  ls.removeEmptyElements(results);
  ls.transformSingleItemLists(results);

  return results;
};

/**
 * Rudimentary replacement of alternative forms of whitespace with normal
 * space character. This is helpful when trimming or getting text length
 * less whitespace.
 */
lucu.sanitize.canonicalizeSpaces = function(document) {
  'use strict';
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  var node = it.nextNode();
  while(node) {
    node.nodeValue = node.nodeValue.replace(/&nbsp;/ig, ' ');
    node.nodeValue = node.nodeValue.replace(/&#xA0;/ig, ' ');
    node.nodeValue = node.nodeValue.replace(/&#160;/g, ' ');
    node = it.nextNode();
  }
};

lucu.sanitize.SELECTOR_LEAF_LIKE = ['area', 'audio', 'br', 'canvas', 'col',
  'hr', 'img', 'source', 'svg', 'track', 'video'].join(',');

/**
 * Returns true if an element is empty. An element is empty 
 * when the element does not contain any child nodes, or when
 * the element is flagged as a leaf element.
 */
lucu.sanitize.isEmptyLike = function(element) {
  'use strict';
  // An element is not empty if it has one or more child nodes
  if(element.firstChild) {
    return false;
  }

  // Certain elements that do have child nodes are still considered empty
  return !element.matches(lucu.sanitize.SELECTOR_LEAF_LIKE);
};

/**
 * Remove all empty-like elements from the document. If removing
 * an element would change the state of the element's parent to also
 * meet the empty-like criteria, then the parent is also removed, and
 * so forth, up the hierarchy, but stopping before doc.body.
 *
 * TODO: This needs a lot of cleanup
 */
lucu.sanitize.removeEmptyElements = function(document) {
  'use strict';

  if(!document || !document.body) {
    
    // something is buggy here
    //console.warn('invalid document for removeEmptyElements, %o', document);
    
    return;
  }

  const filter = Array.prototype.filter;

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
  const elements = document.body.getElementsByTagName('*');
  const emptyLikeElements = filter.call(elements, lucu.sanitize.isEmptyLike);
  
  // TODO: just add children that should be removed to the stack insead of
  // removing them and adding their parents to the stack.
  // Remove all the empty children and shove all the parents on the stack

  const parents = emptyLikeElements.map(function (element) {
    const parentElement = element.parentElement;
    element.remove();
    return parentElement;
  });

  // Avoid removing the body element
  const stack = parents.filter(
    lucu.sanitize.isNotBodyElement.bind(null, document));

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
    if(!grandParent || grandParent == document.body) {
      continue;
    }

    stack.push(grandParent);
  }
};

lucu.sanitize.isNotBodyElement = function(document, element) {
  'use strict';
  return document.body && document.body != element;
};

/**
 * Technically a node without a node value should be deleted. The trim
 * trim node function may set node value to '', so the node still exists,
 * but I now want to remove it. So this iterates over the text nodes
 * and removes those.
 *
 * TODO: rename to removeEmptyTextNodes for clarity
 */
lucu.sanitize.removeEmptyNodes = function(document) {
  'use strict';
  const iterator = document.createNodeIterator(document.body, 
    NodeFilter.SHOW_TEXT);
  var node = document.body;
  while(node = iterator.nextNode()) {
    if(!node.nodeValue) {
      node.remove();
    }
  }
};

/**
 * Removes all attributes from an element except those in the given Set of
 * allowed attributes
 */
lucu.sanitize.removeAttributes = function(allowedAttributes, element) {
  'use strict';
  if(!element) {
    return;
  }

  const attributes = element.attributes;
  if(!attributes) {
    console.debug('element.attributes did not return a collection, %o', element);
    return;
  }

  var name = '';
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
};

lucu.sanitize.DEFAULT_ALLOWED_ATTRIBUTES = new Set(['href','src']);

lucu.sanitize.removeDescendantAttributes = function(allowedAttributes, 
  element) {
  'use strict';
  const ra = lucu.sanitize.removeAttributes;
  ra(allowedAttributes, element);
  const descendants = element.getElementsByTagName('*');
  Array.prototype.forEach.call(descendants, ra.bind(null, 
    allowedAttributes));
};

// TODO: this should be a Set
lucu.sanitize.BLACKLISTED_ELEMENTS = [
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

lucu.sanitize.removeByName = function(document, name) {
  'use strict';
  const root = document.body;
  let element = root.querySelector(name);
  while(element) {
    // console.log('removing %o', element);
    element.remove();
    element = root.querySelector(name);
  }
};

/**
 * Removes all elements in the black list
 */
lucu.sanitize.removeBlacklistedElements = function(document) {
  'use strict';

  const removeWithName = lucu.sanitize.removeByName.bind(null, 
    document);
  lucu.sanitize.BLACKLISTED_ELEMENTS.forEach(removeWithName);

  // Non-standard elements seen in the wild. These cannot be passed
  // as selectors to querySelectorAll so we have to iterate separately
  // TODO: write an outer loop that iterates over the set of exceptional
  // elements to make this less dry
  const root = document.body;
  const gPlusOnes = root.getElementsByTagName('g:plusone');
  for(let i = 0, len = gPlusOnes.length; i < len; i++) {
    // NOTE: gebtn is live so one removal could affect others
    // so we have to check if defined
    // TODO: check if not detached (using root.contains?)
    if(gPlusOnes[i]) {
      gPlusOnes[i].remove();
    }
  }

  const fbComments = root.getElementsByTagName('fb:comments');
  for(let i = 0, len = fbComments.length; i < len; i++) {
    if(fbComments[i]) {
      // TODO: check if not detached
      fbComments[i].remove();
    }
  }
};

/**
 * Remove all comment nodes
 */
lucu.sanitize.removeComments = function(document) {
  'use strict';
  const iterator = document.createNodeIterator(document.body, 
    NodeFilter.SHOW_COMMENT);
  let node = iterator.nextNode();
  while(node) {
    node.remove();
    node = iterator.nextNode();
  }
};

/**
 * Removes script anchors
 * TODO: replace href and leave it in? or remove it?
 * NOTE: does not handle nested anchors correctly, because remove could lead
 * to later removal of children of detached ancestors
 */
lucu.sanitize.removeJavascriptAnchors = function(root) {
  'use strict';
  const filter = Array.prototype.filter;
  const isScript = lucu.sanitize.isScriptAnchor;
  const anchors = root.querySelectorAll('a[href]');
  const scriptAnchors = filter.call(anchors, isScript);
  scriptAnchors.forEach(removeElement);
};

/**
 * Returns whether the anchor's href looks like it contains inline script.
 * TODO: allow for whitespace? /^\s*javascript\s*:/i
 */
lucu.sanitize.isScriptAnchor = function(anchor) {
  'use strict';
  const href = anchor.getAttribute('href');
  return /^javascript:/i.test(href);
};

/**
 * Returns whether an element is invisible
 */
lucu.sanitize.isInvisible = function(element) {
  'use strict';
  // noscript and noembed are exceptions. We always
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

  const style = element.style;
  if(style.display === 'none') {
    return true;
  }

  if(style.visibility === 'hidden' || style.visibility === 'collapse') {
    return true;
  }

  const opacity = parseFloat(style.opacity);
  
  // We don't actually require opacity be 0 to be considered invisible, 
  // just so low that the element is too transparent to be visible
  return opacity < 0.3;
};

lucu.sanitize.removeInvisibleElements = function(document) {
  'use strict';
  //const filter = Array.prototype.filter;
  const elements = document.body.getElementsByTagName('*');
  //const invisibles = filter.call(elements, lucu.sanitize.isInvisible);
  //invisibles.forEach(removeElement);

  // Testing for...of
  for(let element of elements) {
    if(lucu.sanitize.isInvisible(element)) {
      element.remove();
    }
  }

};

lucu.sanitize.isTracerImage = function(image) {
  'use strict';
  const width = image.getAttribute('width');
  const height = image.getAttribute('height');

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
};

lucu.sanitize.removeTracerImages = function(document) {
  'use strict';
  const filter = Array.prototype.filter;
  const isTracer = lucu.sanitize.isTracerImage;
  const images = document.body.getElementsByTagName('img');
  filter.call(images, isTracer).forEach(removeElement);
};

lucu.sanitize.isSourcelessImage = function(image) {
  'use strict';
  // Access by attribute, not by property, since the browser substitutes
  // in the base url if accessing by property.
  const source = image.getAttribute('src');
  return !source || !source.trim();
};

/**
 * Remove all images that do not have a src attribute
 */
lucu.sanitize.removeSourcelessImages = function(document) {
  'use strict';
  const filter = Array.prototype.filter;
  const images = document.body.getElementsByTagName('img');
  const isSourceless = lucu.sanitize.isSourcelessImage;
  const sourcelessImages = filter.call(images, isSourceless);
  sourcelessImages.forEach(removeElement);
};

/**
 * Unwraps noscript elements
 * Testing example:
 * http://fortune.com/2014/09/09/apple-event-overshadows-bad-news-snapchat-tinder/
 */
lucu.sanitize.unwrapNoscripts = function(document) {
  'use strict';
  const forEach = Array.prototype.forEach;
  const noscripts = document.body.getElementsByTagName('noscript');
  forEach.call(noscripts, unwrapElement);
};

/**
 * Unwrap all noframes elements.
 * See http://www.miracleas.com/BAARF/ as testing example.
 */
lucu.sanitize.unwrapNoframes = function(document) {
  'use strict';
  const noframes = document.body.getElementsByTagName('noframes');
  Array.prototype.forEach.call(noframes, unwrapElement);
};

/**
 * Extremely simple <br>2<p> transformation. This does not quite work
 * like I prefer but it sort of does the job. It turns out to be really
 * complicated to make it work
 */
lucu.sanitize.transformBreaks = function(document) {
  'use strict';
  var br = document.body.querySelector('br');
  while(br) {
    br.parentNode.replaceChild(document.createElement('p'), br);
    br = document.body.querySelector('br');
  }
}

// Added 'tt' (teletype) element. It is obsolete but I prefer such articles
// not to be rendered in fixed-width font.
lucu.sanitize.UNWRAPPABLE_ELEMENTS = [
  'article','big','blink','body','center','colgroup','data','details',
  'div','font','footer','form','header','help','hgroup', 'ilayer', 'insert',
  'label','layer','legend', 'main','marquee', 'meter', 'multicol','nobr',
  'noembed','noscript','plaintext','section', 'small','span','tbody',
  'tfoot','thead', 'tt'
].join(',');

/**
 * Unwraps certain descendant elements of the root element
 */
lucu.sanitize.unwrapDescendants = function(rootElement) {
  'use strict';

  const filter = Array.prototype.filter;

  // NOTE: this performs extremely poorly when dealing with a large
  // number of elements. For example, it took ~20 secs on
  // https://www.omniref.com/ruby/2.2.0.preview1/symbols/Object
  // It is the querySelector call
  // So, tentatively, we are using an upper bound of 3000 iterations

  const unwrappables = lucu.sanitize.UNWRAPPABLE_ELEMENTS;

  // We use querySelector and do one at element at a time in order to avoid
  // unwrapping elements that, as a result of a previous iteration, now exist
  // in a detached axis. The alternative would be to check whether the root
  // element still contains each element before unwrapping it.

  var element = rootElement.querySelector(unwrappables);
  var numIterations = 0;
  while(element && (numIterations < 3000)) {
    unwrapElement(element);
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

  const anchors = rootElement.getElementsByTagName('a');

  // TODO: use a separate function
  const nominalAnchors = filter.call(anchors, function(anchor) {
    const href = anchor.getAttribute('href');

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

  nominalAnchors.forEach(unwrapElement);
};

// Unwrap single item lists. For now just ul
lucu.sanitize.transformSingleItemLists = function(rootElement) {
  'use strict';
  const forEach = Array.prototype.forEach;
  const uLists = rootElement.getElementsByTagName('ul');

  // TODO: separate out as helper function
  forEach.call(uLists, function(list) {
    // Avoid mutation while iterating issues
    if(!list) return;

    const reduce = Array.prototype.reduce;

    // Count the immediate list item children
    // TODO: separate out as a helper function
    const itemCount = reduce.call(list.childNodes, function(count, node) {
      return count + (node.nodeType == Node.ELEMENT_NODE &&
        node.localName == 'li' ? 1 : 0);
    }, 0);

    if(itemCount == 1) {
      const parent = list.parentElement;
      const item = list.querySelector('li');
      const nextSibling = list.nextSibling;

      if(nextSibling) {
        while(item.firstChild) {
          parent.insertBefore(item.firstChild, nextSibling);
        }
      } else {
        while(item.firstChild) {
          parent.appendChild(item.firstChild);
        }
      }

      list.remove();
    }
  });
};
