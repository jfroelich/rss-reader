// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

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

lucu.removeBlacklistedElements = function(doc) {

  var s = ['applet', 'base', 'basefont', 'bgsound', 'button', 'command',
    'datalist', 'dialog', 'embed', 'fieldset', 'frame', 'frameset', 'head',
    'html', 'iframe', 'input', 'isindex', 'math', 'link', 'menu', 'menuitem',
    'meta', 'noframes', 'object','optgroup', 'option', 'output', 'param',
    'progress', 'script', 'select', 'spacer', 'style', 'textarea', 'title',
    'xmp'].join(',');

  var elements = doc.body.querySelectorAll(s);
  for(var i = 0, len = elements.length, element; i < len; i++) {
    elements[i].remove();
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
  var images = doc.body.getElementsByTagName('img');
  Array.prototype.filter.call(images, function(e) {
    return e.width == 1 || e.height == 1;
  }).forEach(function(e) {
    e.remove();
  });
};

lucu.KNOWN_ELEMENTS = new Set(['a', 'abbr', 'acronym', 'address', 'area',
  'article', 'aside', 'audio', 'b', 'bdi', 'bdo', 'big', 'blink',
  'blockquote', 'body', 'br', 'canvas', 'caption', 'center', 'cite',
  'code', 'col', 'colgroup', 'data', 'details', 'dir', 'dd', 'del', 'dfn',
  'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'font', 'footer',
  'form', 'header', 'help', 'hgroup','hr', 'h1', 'h2', 'h3', 'h4','h5',
  'h6', 'i', 'ilayer', 'img', 'ins', 'insert', 'label', 'layer', 'legend',
  'li', 'kbd', 'keygen', 'main', 'mark', 'marquee', 'map', 'menu',
  'menuitem', 'meter', 'multicol', 'nav', 'nobr', 'noembed',
  'noscript', 'ol', 'p', 'plaintext', 'pre', 'q', 'rect',
  'rp', 'rt', 'ruby', 's', 'samp', 'section', 'small', 'source',
  'span', 'strike', 'strong', 'sub', 'summary', 'sup', 'svg', 'table',
  'tbody', 'td', 'tfoot', 'th', 'thead', 'time','tr', 'track', 'tt',
  'u', 'ul', 'var', 'video', 'wbr']);

lucu.removeUnknownElements = function(doc) {
  var elements = doc.body.getElementsByTagName('*');
  Array.prototype.filter.call(elements, function(e) {
    return !lucu.KNOWN_ELEMENTS.has(e.localName);
  }).forEach(function(e) {
    e.remove();
  });
};

lucu.transformShims = function(doc) {
  var shims = doc.body.querySelectorAll('noscript, noembed');
  Array.prototype.forEach.call(shims, function(e) {
    // TODO: this needs to check contains to avoid
    // processing <noscript><noscript>..</noscript></noscript>
    if(e.childNodes.length < 3 || e.innerText.length < 100) {
      e.remove();
      return;
    }
    // TODO: is visibility a clue?
    // Otherwise, it is probably a template that contains possibly important
    // content (like the entire article in the case of cbsnews) so we just
    // unwrap it. We must do something with it, because we disable the
    // javascript that would normally expose its content on load.
    lucu.unwrap(e);
  });
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
  while(e.firstChild) {
    e.parentElement.insertBefore(e.firstChild, e);
  }

  e.remove();
};
