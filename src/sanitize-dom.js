// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file





function sanitizeDocument(document) {
  'use strict';

  removeComments(document);
  removeBlacklistedElements(document);
  removeSourcelessImages(document);
  removeTracerImages(document);
  unwrapNoscripts(document);
  unwrapNoframes(document);

  // Temp disabled during development
  // ls.removeInvisibleElements(document);

  canonicalizeSpaces(document);
  trimNodes(document);
  removeEmptyNodes(document);
  removeLeafElements(document);

  const results = calamine.transform(document, {
    FILTER_NAMED_AXES: true,
    ANNOTATE: false
  });

  removeJavascriptAnchors(results);
  unwrapDescendants(results);

  removeDescendantAttributes(results);

  trimDocument(results);
  removeLeafElements(results);
  transformSingleItemLists(results);

  return results;
}

function canonicalizeSpaces(document) {
  'use strict';
  const iterator = document.createNodeIterator(document.body, 
    NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while(node) {
    node.nodeValue = node.nodeValue.replace(/&nbsp;/ig, ' ');
    node.nodeValue = node.nodeValue.replace(/&#xA0;/ig, ' ');
    node.nodeValue = node.nodeValue.replace(/&#160;/g, ' ');
    node = iterator.nextNode();
  }
}

function isLeafElement(element) {
  'use strict';

  const EXCEPTIONS = ['area', 'audio', 'br', 'canvas', 'col',
    'hr', 'img', 'source', 'svg', 'track', 'video'].join(',');

  if(element.firstChild) {
    return false;
  }

  return !element.matches(EXCEPTIONS);
}


function removeLeafElements(document) {
  'use strict';

  if(!document || !document.body) {
    return;
  }

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
  // has to be in a couple places. In isLeafElement, an anchor without
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

  // TODO: just add children that should be removed to the stack insead of
  // removing them and adding their parents to the stack.
  // Remove all the empty children and shove all the parents on the stack

  const elements = document.body.getElementsByTagName('*');
  const leaves = Array.prototype.filter.call(elements, isLeafElement);
  const parents = leaves.map(function(element) {
    const parent = element.parentElement;
    element.remove();
    return parent;
  });
  const stack = parents.filter(function(document, element) {
    return document.body && document.body != element;
  });

  let parent, grandParent;

  while(stack.length) {
    parent = stack.pop();

    if(parent.firstChild) {
      // There are other nodes in the parent after the child was removed,
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
    if(!grandParent || grandParent == document.body) {
      continue;
    }

    stack.push(grandParent);
  }
}

function removeEmptyNodes(document) {
  'use strict';
  const iterator = document.createNodeIterator(document.body, 
    NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while(node) {
    if(!node.nodeValue) {
      node.remove();
    }
    node = iterator.nextNode();
  }
}

function removeDescendantAttributes(element) {
  'use strict';
  removeAttributes(element);
  const descendants = element.getElementsByTagName('*');
  Array.prototype.forEach.call(descendants, removeAttributes);
}

function removeAttributes(element) {
  'use strict';

  if(!element) {
    return;
  }

  const attributes = element.attributes;
  if(!attributes) {
    return;
  }

  let index = attributes.length;
  while(index--) {
    let name = attributes[index].name;
    if(name !== 'href' && name !== 'src') {
      element.removeAttribute(name);
    }
  }
}

function removeBlacklistedElements(document) {
  'use strict';

  const BLACKLISTED_ELEMENTS = [
    'head',
    'applet', 'base', 'basefont', 'bgsound', 'button', 'command',
    'datalist', 'dialog', 'embed', 'fieldset', 'frameset',
    'html', 'iframe', 'input', 'isindex', 'math', 'link', 'menu',
    'menuitem',
    'meta', 'object','optgroup',  'output', 'param', 'progress',
    'script', 'spacer', 'style', 'textarea', 'title', 'xmp',
    'select', 'option'
  ];

  BLACKLISTED_ELEMENTS.forEach(function(name) {
    const root = document.body;
    let element = root.querySelector(name);
    while(element) {
      element.remove();
      element = root.querySelector(name);
    }
  });

  const root = document.body;
  const gPlusOnes = root.getElementsByTagName('g:plusone');
  for(let i = 0, len = gPlusOnes.length; i < len; i++) {
    if(gPlusOnes[i]) {
      gPlusOnes[i].remove();
    }
  }

  const fbComments = root.getElementsByTagName('fb:comments');
  for(let i = 0, len = fbComments.length; i < len; i++) {
    if(fbComments[i]) {
      fbComments[i].remove();
    }
  }
}

function removeComments(document) {
  'use strict';
  const iterator = document.createNodeIterator(document.body, 
    NodeFilter.SHOW_COMMENT);
  let node = iterator.nextNode();
  while(node) {
    node.remove();
    node = iterator.nextNode();
  }
}

function removeJavascriptAnchors(root) {
  'use strict';
  const anchors = root.querySelectorAll('a[href]');
  const scriptAnchors = Array.prototype.filter.call(anchors, function(anchor) {
    return /^\s*javascript\s*:/i.test(anchor.getAttribute('href'));
  });
  scriptAnchors.forEach(removeElement);
}

function removeInvisibleElements(document) {
  'use strict';
  const elements = document.body.getElementsByTagName('*');
  const invisibles = Array.prototype.filter.call(elements, function(element) {
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
  });
  invisibles.forEach(removeElement);
}

function removeTracerImages(document) {
  'use strict';
  const images = document.body.getElementsByTagName('img');
  const tracers = Array.prototype.filter.call(images, function(image) {
    const width = image.getAttribute('width');
    const height = image.getAttribute('height');
    return width === '0' || width === '0px' || width === '1' ||
      height === '1px' || height === '1' || image.width === 0 ||
      image.width === 1 || image.height === 0 || image.height === 1;
  });
  tracers.forEach(removeElement);
}

function removeSourcelessImages(document) {
  'use strict';
  const images = document.body.getElementsByTagName('img');
  const sourceless = Array.prototype.filter.call(images, function(image) {
    const source = image.getAttribute('src');
    return !source || !source.trim();
  });
  sourceless.forEach(removeElement);
}

function unwrapNoscripts(document) {
  'use strict';
  const noscripts = document.body.getElementsByTagName('noscript');
  Array.prototype.forEach.call(noscripts, unwrapElement);
}

function unwrapNoframes(document) {
  'use strict';
  const noframes = document.body.getElementsByTagName('noframes');
  Array.prototype.forEach.call(noframes, unwrapElement);
}

// TODO: improve this someday, this is admittedly rudimentary
function transformBreaks(document) {
  'use strict';
  var br = document.body.querySelector('br');
  while(br) {
    br.parentNode.replaceChild(document.createElement('p'), br);
    br = document.body.querySelector('br');
  }
}

function unwrapDescendants(rootElement) {
  'use strict';
  const UNWRAPPABLE_ELEMENTS = [
    'article','big','blink','body','center','colgroup','data','details',
    'div','font','footer','form','header','help','hgroup', 'ilayer', 'insert',
    'label','layer','legend', 'main','marquee', 'meter', 'multicol','nobr',
    'noembed','noscript','plaintext','section', 'small','span','tbody',
    'tfoot','thead', 'tt'
  ].join(',');

  let element = rootElement.querySelector(UNWRAPPABLE_ELEMENTS);
  let numIterations = 0;
  while(element && (numIterations < 3000)) {
    unwrapElement(element);
    element = rootElement.querySelector(UNWRAPPABLE_ELEMENTS);
    numIterations++;
  }

  // We do a second pass for the special situation of anchors that do
  // not have an href value.
  const anchors = rootElement.getElementsByTagName('a');
  const nominals = Array.prototype.filter.call(anchors, function(anchor) {
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
  nominals.forEach(unwrapElement);
}

function transformSingleItemLists(rootElement) {
  'use strict';
  const lists = rootElement.getElementsByTagName('ul');
  Array.prototype.forEach.call(lists, function(list) {
    if(!list) return;
    const reduce = Array.prototype.reduce;
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
}
