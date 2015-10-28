// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

function sanitizeDocument(document) {
  'use strict';

  const forEach = Array.prototype.forEach;
  const filter = Array.prototype.filter;

  function remove(element) {
    element.remove();
  }

  // Strip comments
  const commentIterator = document.createNodeIterator(
    document.body, NodeFilter.SHOW_COMMENT);
  let node = commentIterator.nextNode();
  while(node) {
    node.remove();
    node = commentIterator.nextNode();
  }

  // Strip blacklisted elements
  const BLACKLISTED_ELEMENTS = [
    'head', 'applet', 'base', 'basefont', 'bgsound', 'button', 'command',
    'datalist', 'dialog', 'embed', 'fieldset', 'frameset',
    'html', 'iframe', 'input', 'isindex', 'math', 'link', 'menu',
    'menuitem', 'meta', 'object','optgroup',  'output', 'param', 'progress',
    'script', 'spacer', 'style', 'textarea', 'title', 'xmp',
    'select', 'option'
  ];

  BLACKLISTED_ELEMENTS.forEach(function(name) {
    let element = document.body.querySelector(name);
    while(element) {
      element.remove();
      element = document.body.querySelector(name);
    }
  });

  // Strip blacklisted elements that cannot be used as selectors
  const gPlusOnes = document.body.getElementsByTagName('g:plusone');
  forEach.call(gPlusOnes, remove);

  const fbComments = document.body.getElementsByTagName('fb:comments');
  forEach.call(fbComments, remove);

  // Remove sourceless images
  let images = document.body.getElementsByTagName('img');
  filter.call(images, function(image) {
    const source = image.getAttribute('src');
    return !source || !source.trim();
  }).forEach(remove);

  // Remove tracer-like images
  images = document.body.getElementsByTagName('img');
  filter.call(images, function(image) {
    const width = image.getAttribute('width');
    const height = image.getAttribute('height');
    return width === '0' || width === '0px' || width === '1' ||
      height === '1px' || height === '1' || image.width === 0 ||
      image.width === 1 || image.height === 0 || image.height === 1;
  }).forEach(remove);

  // Unwrap noscript elements
  const noscripts = document.body.getElementsByTagName('noscript');
  forEach.call(noscripts, unwrapElement);

  // Unwrap noframe elements
  const noframes = document.body.getElementsByTagName('noframes');
  forEach.call(noframes, unwrapElement);

  /*
  // Remove hidden elements
  // TODO: enable once the performance issues are resolved
  // TODO: element.offsetWidth < 1 || element.offsetHeight < 1; ??
  const elements = document.body.getElementsByTagName('*');
  const invisibles = filter.call(elements, function(element) {
    if(element.localName == 'noscript' || element.localName == 'noembed') {
      return false;
    }
    const style = element.style;
    if(style.display === 'none' || style.visibility === 'hidden' || 
      style.visibility === 'collapse') {
      return true;
    }
    const opacity = parseFloat(style.opacity);
    return opacity < 0.3;
  });
  invisibles.forEach(remove);
  */

  // Canonicalize spaces
  let textNodeIterator = document.createNodeIterator(
    document.body, NodeFilter.SHOW_TEXT);
  node = textNodeIterator.nextNode();
  while(node) {
    node.nodeValue = node.nodeValue.replace(/&nbsp;/ig, ' ');
    node.nodeValue = node.nodeValue.replace(/&#xA0;/ig, ' ');
    node.nodeValue = node.nodeValue.replace(/&#160;/g, ' ');
    node = textNodeIterator.nextNode();
  }

  /*
  // Transform break rule elements into paragraphs
  // TODO: improve this
  let br = document.body.querySelector('br');
  while(br) {
    br.parentNode.replaceChild(document.createElement('p'), br);
    br = document.body.querySelector('br');
  }
  */

  trimTextNodes(document);

  // Remove empty text nodes after trimming
  textNodeIterator = document.createNodeIterator(
    document.body, NodeFilter.SHOW_TEXT);
  node = textNodeIterator.nextNode();
  while(node) {
    if(!node.nodeValue) {
      node.remove();
    }
    node = textNodeIterator.nextNode();
  }

  removeLeaves(document);

  // Strip shingles
  const results = calamine.transform(document, {
    FILTER_NAMED_AXES: true,
    ANNOTATE: false
  });

  // Strip javascript anchors
  filter.call(results.querySelectorAll('a[href]'), function(anchor) {
    return /^\s*javascript\s*:/i.test(anchor.getAttribute('href'));
  }).forEach(remove);

  // Unwrap various inline elements
  const UNWRAPPABLE_ELEMENTS = [
    'article', 'big', 'blink', 'body', 'center', 'colgroup', 'data', 
    'details', 'div', 'font', 'footer', 'form', 'header', 'help',
    'hgroup', 'ilayer', 'insert', 'label', 'layer', 'legend', 'main',
    'marquee', 'meter', 'multicol', 'nobr', 'noembed', 'noscript',
    'plaintext', 'section', 'small', 'span', 'tbody', 'tfoot', 
    'thead', 'tt'
  ].join(',');

  let element = results.querySelector(UNWRAPPABLE_ELEMENTS);
  let numIterations = 0;
  while(element && (numIterations < 3000)) {
    unwrapElement(element);
    element = results.querySelector(UNWRAPPABLE_ELEMENTS);
    numIterations++;
  }

  // Unwrap nominal anchors
  filter.call(results.getElementsByTagName('a'), function(anchor) {
    const href = anchor.getAttribute('href');
    return !href || !href.trim();
  }).forEach(unwrapElement);

  // Strip attributes from all elements
  function removeAttributes(element) {
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
  removeAttributes(results);
  forEach.call(results.getElementsByTagName('*'), removeAttributes);

  trimElement(results);
  removeLeaves(results);
  transformSingleItemLists(results);
  return results;
}

function removeLeaves(document) {
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

  const LEAF_EXCEPTIONS = ['area', 'audio', 'br', 'canvas', 'col',
    'hr', 'img', 'source', 'svg', 'track', 'video'].join(',');
  const elements = document.body.getElementsByTagName('*');
  const leaves = Array.prototype.filter.call(elements, function(element) {
    return !element.firstChild && !element.matches(LEAF_EXCEPTIONS);
  });
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

// NOTE: not optimized for live documents
function unwrapElement(element) {
  'use strict';
  const parent = element.parentElement;

  // Avoid issues with documentElement or detached elements
  if(!parent) {
    return;
  }

  // Move each child of the element to the position preceding the element in
  // the parent's node list, maintaining child order.
  while(element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  element.remove();
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

function trimElement(element) {
  'use strict';

  function isTrimmableElement(element) {
    'use strict';
    if(!element) return false;
    if(element.nodeType != Node.ELEMENT_NODE) return false;
    let name = element.localName;
    if(name == 'br') return true;
    if(name == 'hr') return true;
    if(name == 'p' && !element.firstChild) return true;
    return false;
  }

  let sibling = element;
  let node = element.firstChild;
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

function trimTextNodes(document) {
  'use strict';

  const WHITESPACE_SENSITIVE = 'code, code *, pre, pre *, ' + 
    'ruby, ruby *, textarea, textarea *, xmp, xmp *';
  const elements = document.body.querySelectorAll(WHITESPACE_SENSITIVE);
  const preformatted = new Set(Array.prototype.slice.call(elements));

  const INLINE_ELEMENTS = new Set(['a','abbr', 'acronym', 'address',
    'b', 'bdi', 'bdo', 'blink','cite', 'code', 'data', 'del',
    'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'mark', 'map',
    'meter', 'q', 'rp', 'rt', 'samp', 'small', 'span', 'strike',
    'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var'
  ]);

  function isElement(node) {
    return node.nodeType == Node.ELEMENT_NODE;
  }

  function isInline(node) {
    return INLINE_ELEMENTS.has(node.localName);
  }

  const iterator = document.createNodeIterator(document.body, 
    NodeFilter.SHOW_TEXT);
  let node;
  while(node = iterator.nextNode()) {
    if(preformatted.has(node.parentElement)) {
      continue;
    }

    if(node.previousSibling) {
      if(isElement(node.previousSibling)) {
        if(isInline(node.previousSibling)) {
          if(node.nextSibling) {
            if(isElement(node.nextSibling)) {
              if(!isInline(node.nextSibling)) {
                node.nodeValue = node.nodeValue.trimRight();
              }
            }
          } else {
            node.nodeValue = node.nodeValue.trimRight();
          }
        } else {
         node.nodeValue = node.nodeValue.trim();
        }
      } else {
       if(node.nextSibling) {
          if(isElement(node.nextSibling)) {
            if(isInline(node.nextSibling)) {
            } else {
             node.nodeValue = node.nodeValue.trimRight();
            }
          }
        } else {
          node.nodeValue = node.nodeValue.trimRight();
        }
      }
    } else if(node.nextSibling) {
     if(isElement(node.nextSibling)) {
        if(isInline(node.nextSibling)) {
          node.nodeValue = node.nodeValue.trimLeft();
        } else {
          node.nodeValue = node.nodeValue.trim();
        }
      } else {
        node.nodeValue = node.nodeValue.trimLeft();
      }
    } else {
      node.nodeValue = node.nodeValue.trim();
    }
  }
}
