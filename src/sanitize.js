// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// href and src for proper images and anchors. Otherwise
// we allow some custom attributes from calamine debugging through
lucu.DEFAULT_ALLOWED_ATTRIBUTES = new Set(['href','src','charCount',
  'hasCopyrightSymbol','bulletCount', 'imageBranch', 'pipeCount',
  'score']);

lucu.UNWRAPPABLES = new Set([
  'article','big','blink','body','center',
  'colgroup','data','details','div','font',
  'footer','form','header','help','hgroup',
  'ilayer', 'insert', 'label','layer','legend',
  'main','marquee', 'meter', 'multicol','nobr',
  'noembed','noscript','plaintext','section',
  'small','span','tbody','tfoot','thead'
]);

lucu.canonicalizeSpaces = function(doc) {

  var pattern = /&;(nbsp|#(xA0|160));/g;
  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var node;
  while(node = it.nextNode()) {
    node.nodeValue = node.nodeValue.replace(pattern,' ');
  }
};

lucu.isEmptyLike = function(element) {

  if(element.firstChild) {
    return false;
  }

  return !element.matches(['area', 'audio', 'br', 'canvas', 'col',
    'hr', 'img', 'source', 'svg', 'track', 'video'].join(','));
};

lucu.INLINE_ELEMENTS = new Set(['a','abbr', 'acronym', 'address',
  'b', 'bdi', 'bdo', 'blink','cite', 'code', 'data', 'del',
  'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'mark', 'map',
  'meter', 'q', 'rp', 'rt', 'samp', 'small', 'span', 'strike',
  'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var']);

lucu.isInline = function(element) {
  // Element may be undefined since the caller does not check
  // if node.nextSibling or node.previousSibling are defined
  // before the call. This is expected.
  if(!element) {
    return false;
  }

  // This condition definitely happens, not exactly
  // sure how or why
  // TODO: does this mean it is inline? should this
  // be returning true?
  if(element.nodeType != Node.ELEMENT_NODE) {
    return false;
  }

  return lucu.INLINE_ELEMENTS.has(element.localName);
};

lucu.removeAndReturnParent = function(element) {
  var parentElement = element.parentElement;
  element.remove();
  return parentElement;
};

lucu.removeAttributes = function(allowedAttributes, element) {
  var attributes = element.attributes, name, index = attributes.length;
  while(index--) {
    name = attributes[index].name;
    if(!allowedAttributes.has(name)) {
      element.removeAttribute(name);
    }
  }
};

lucu.removeDescendantAttributes = function(allowedAttributes, element) {
  lucu.removeAttributes(allowedAttributes, element);
  var elements = element.getElementsByTagName('*');
  Array.prototype.forEach.call(elements,
    lucu.removeAttributes.bind(this, allowedAttributes));
};

lucu.removeBlacklistedElements = function(doc) {

  var s = [
    'applet', 'base', 'basefont', 'bgsound', 'button', 'command',
    'datalist', 'dialog', 'embed', 'fieldset',
    'frameset',
    'head',
    'html', 'iframe', 'input', 'isindex', 'math', 'link', 'menu', 'menuitem',
    'meta', 'object','optgroup', 'option', 'output', 'param',
    'progress', 'script', 'select', 'spacer', 'style', 'textarea', 'title',
    'xmp'
    ].join(',');

  var elements = doc.body.querySelectorAll(s);
  for(var i = 0, len = elements.length; i < len; i++) {
    // console.log('removing blist %s', elements[i].localName);
    elements[i].remove();
  }

  // Non-standard elements seen in the wild
  var gPlusOnes = doc.body.getElementsByTagName('g:plusone');
  for(var i = 0, len = gPlusOnes.length; i < len; i++) {

    // NOTE: gebtn is live so one removal could affect others
    // so we have to check if defined

    if(gPlusOnes[i]) {
      gPlusOnes[i].remove();
    }
  }

  var fbComments = doc.body.getElementsByTagName('fb:comments');
  for(var i = 0, len = fbComments.length; i < len; i++) {
    if(fbComments[i]) {
      fbComments[i].remove();
    }
  }
};

lucu.removeComments = function(doc) {
//forEachNode(doc.body, NodeFilter.SHOW_COMMENT, removeNode);

  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_COMMENT);
  var node;
  while(node = it.nextNode()) {
    node.remove();
  }
};

lucu.removeEmptyNodes = function(doc) {
  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var node;
  while(node = it.nextNode()) {
    if(!node.nodeValue) {
      node.remove();
    }
  }
};

lucu.removeEmptyElements = function(doc) {

  // TODO: This needs a lot of cleanup

  // Remove all empty-like elements from the document. If removing
  // an element would change the state of the element's parent to also
  // meet the empty-like criteria, then the parent is also removed, and
  // so forth, up the hierarchy, but stopping before doc.body.

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
  // has to be in a couple places. in isEmptyLike, an anchor without
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
  // ugliness of using a map function with a side effet. Instead, start by
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
  var emptyLikeElements = Array.prototype.filter.call(elements, lucu.isEmptyLike);

  // TODO: just add children that should be removed to the stack insead of
  // removing them and adding their parents to the stack.

  // Remove all the empty children and shove all the parents on the stack
  var parents = emptyLikeElements.map(lucu.removeAndReturnParent);
  var stack = parents.filter(function isNotRoot(element) {
    if(!element) {
      return true;
    }

    var doc = element.ownerDocument;
    if(!doc) {
      return true;
    }

    var root = doc.body;
    if(!root) {
      return true;
    }

    return root != element;
  });

  var parent, grandParent;

  while(stack.length) {
    parent = stack.pop();

    if(parent.firstChild) {
      // There are other nodes/elements in the parent after
      // the child was removed (when building the stack),
      // so do not remove the parent.
      continue;
    }

    // Grab a reference to the grand parent before removal
    // because after removal it is undefined
    grandParent = parent.parentElement;
    parent.remove();

    // If there was no grand parent (how would that ever happen?)
    // or the grand parent is the root, then do not add the new
    // grand parent to the stack
    if(!grandParent || grandParent == doc.body) {
      continue;
    }

    stack.push(grandParent);
  }
};

lucu.removeJavascriptAnchors = function(root) {
  var filter = Array.prototype.filter;
  var anchors = root.querySelectorAll('a[href]');
  var candidates = filter.call(anchors, function(anchor) {
    return /^javascript:/i.test(anchor.getAttribute('href'));
  });

  // TODO: replace href and leave it in? or remove it?
  // NOTE: does not handle nested anchors correctly
  candidates.forEach(function(anchor) {
    console.debug('removing %s', anchor.outerHTML);
    anchor.remove();
  });
};

lucu.removeInvisibleElements = function(doc) {
  var elements = doc.body.getElementsByTagName('*');
  var invisibles = Array.prototype.filter.call(elements, function(e) {
    if(e.localName == 'noscript' || e.localName == 'noembed') {
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
    // Something about emulating how jquery does it?
    // TODO: consider if(element.hidden) ?
    var s = e.style;
    if(s.display === 'none') {
      return true;
    }
    if(s.visibility === 'hidden' || s.visibility === 'collapse') {
      return true;
    }
    var opacity = parseFloat(s.opacity);
    return opacity < 0.3;
  });
  invisibles.forEach(function(e) {
    e.remove();
  });
};

lucu.removeTracerImages = function(doc) {
  var filter = Array.prototype.filter;
  var images = doc.body.getElementsByTagName('img');
  filter.call(images, function(e) {
    var width = e.getAttribute('width');

    // The fact that an image will not be visible in the page does not prevent
    // Chrome from trying to fetch it, which is abused as a tracking device
    // So we also check for zero widths
    return width === '0' || width === '0px' || e.width === 1 || e.height === 1;

  }).forEach(function(e) {
    e.remove();
  });
};

lucu.removeSourcelessImages = function(doc) {
  var filter = Array.prototype.filter;
  var images = doc.body.getElementsByTagName('img');
  var sourcelessImages = filter.call(images, function(image) {
    var source = image.getAttribute('src');
    return source && source.trim() ? false : true;
  });

  sourcelessImages.forEach(function(image) {
    // console.debug('removing sourceless image %s', image.outerHTML);
    image.remove();
  });
};

lucu.unwrapNoscripts = function(doc) {

  // http://fortune.com/2014/09/09/apple-event-overshadows-bad-news-snapchat-tinder/

  var forEach = Array.prototype.forEach;
  var noscripts = doc.body.getElementsByTagName('noscript');
  forEach.call(noscripts, lucu.unwrap);
};

lucu.unwrapNoframes = function(doc) {
  // http://www.miracleas.com/BAARF/
  var forEach = Array.prototype.forEach;
  var noframes = doc.body.getElementsByTagName('noframes');
  forEach.call(noframes, function(e) {
    console.log('unwrapping noframes'); lucu.unwrap(e); });
}

lucu.isTrimmableElement = function(element) {
  return element && element.nodeType == Node.ELEMENT_NODE &&
    (element.localName == 'br' || element.localName == 'hr' ||
      (element.localName == 'p' && !element.firstChild));
};

lucu.trimElement = function(element) {
  var node = element.firstChild;
  var sibling;
  while(lucu.isTrimmableElement(node)) {
    sibling = node.nextSibling;
    node.remove();
    node = sibling;
  }
  node = element.lastChild;
  while(lucu.isTrimmableElement(node)) {
    sibling = node.previousSibling;
    node.remove();
    node = sibling;
  }
};

lucu.trimNodes = function(doc) {

  var elements = doc.body.querySelectorAll('code, code *, pre, pre *,'+
    ' ruby, ruby *, textarea, textarea *, xmp, xmp *');
  var preformatted = new WeakSet(Array.prototype.slice.call(elements));

  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var node;
  while(node = it.nextNode()) {
    if(preformatted.has(node.parentElement)) {
      continue;
    }

    if(lucu.isInline(node.previousSibling)) {
      if(!lucu.isInline(node.nextSibling)) {
        node.nodeValue = node.nodeValue.trimRight();
      }
    } else if(lucu.isInline(node.nextSibling)) {
      node.nodeValue = node.nodeValue.trimLeft();
    } else {
      node.nodeValue = node.nodeValue.trim();
    }
  }
};

lucu.unwrap = function(e) {

  /*
  // TODO: test if this works instead of below

  var doc = element.ownerDocument;
  var frag = doc.createDocumentFragment();
  var next = element.nextSibling;
  var parent = element.parentElement;
  element.remove();
  while(element.firstChild) {
    frag.appendChild(element.firstChild);
  }
  if(next) {
    // TODO: arg order?
    parent.insertBefore(next, frag);
  } else {
    parent.appendChild(frag);
  }
  */

  while(e.firstChild) {
    e.parentElement.insertBefore(e.firstChild, e);
  }

  e.remove();
};

lucu.RE_JAVASCRIPT_PROTOCOL = /^\s*javascript\s*:/i;

lucu.unwrapDescendants = function(rootElement) {

  // BUG: this does not work. I dont think the native traversal mechanisms
  // can handle the particular unwrap transform. I think its because the
  // child gets put before the parent.

  // TODO: use a custom iterator that finds the next node before unwrapping
  // and then steps to visit the next node.


  var doc = rootElement.ownerDocument;

  var it = doc.createNodeIterator(rootElement, NodeFilter.SHOW_ELEMENT, function(e) {
    // Unwrap href-less anchors and javascript anchors
    if(e.localName == 'a') {
      var href = (e.getAttribute('href') || '').trim();

      if(!href) {
        return NodeFilter.FILTER_ACCEPT;
      }

      if(lucu.RE_JAVASCRIPT_PROTOCOL.test(href)) {
        return NodeFilter.FILTER_ACCEPT;
      }

      return NodeFilter.FILTER_REJECT;
    }

    var isUnwrappable = lucu.UNWRAPPABLES.has(e.localName);

    console.debug('Is %o unwrappable? %s', e, isUnwrappable);

    return isUnwrappable ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
  });

  var node;

  while(node = it.nextNode()) {
    lucu.unwrap(node);
  }
};
