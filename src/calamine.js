// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: express everything as probability? Use a scale of 0 to 100
// to represent each element's likelihood of being useful content, where
// 100 is most likely. Every blcok gets its own probability score. Then
// iteratively backfrom from a threshold of something like 50%. Or instead
// of blocks weight the elements and use the best element approach again,
// where probability means the likelihood of any given element being the
// best element, not whether it is content or boilerplate.

// TODO: when the main container has several links, the text bias is very 
// negative. Maybe propagate link text to only block level containers,
// or proportionally decrease the negative bias based on depth

// Note: Ideally, a block-based approach would avoid the need for the blacklisted
// elements removal step but the current best element approach effectively requires
// it. These selectors target boilerplate typically found in the best
// element, after processing, but are applied before processing to reduce the
// amount of elements considered and reduce error.

// TODO: re intrinsic bias, there are only maybe 5-6 likely elements and 
// everything else is very unlikely. <div> is the most likely.

const Calamine = {};

{ // BEGIN LEXICAL SCOPE

const reduce = Array.prototype.reduce;

// Modifies the input document by removing boilerplate text. Also 
// tidies and compresses markup.
function transform(doc, annotate) {

  const document = HTMLDocumentWrapper.wrap(doc);
  const setAnnotation = annotate ? setDatasetProperty : noop;

  // Remove comments
  document.forEachNode(NodeFilter.SHOW_COMMENT, remove);
  // Remove blacklisted elements matching selectors
  BLACKLIST_SELECTORS.forEach(function(selector) {
    document.querySelectorAll(selector).forEach(remove);
  });
  // Remove tracer images
  document.getElementsByTagName('img').filter(isTracer).forEach(remove);
  // Unwrap noscript and noframes
  document.querySelectorAll('noscript, noframes', unwrap);
  // Remove hidden elements
  document.getElementsByTagName('*').filter(isHidden).forEach(remove);

  // Canonicalize whitespace
  document.forEachNode(NodeFilter.SHOW_TEXT, canonicalizeWhitespace);

  // Transform break rule elements into paragraphs
  // TODO: improve this
  document.getElementsByTagName('br').forEach(function(element) {
    const p = document.createElement('p');
    element.parentNode.replaceChild(p, element);
  });

  trimTextNodes(document);

  document.forEachNode(NodeFilter.SHOW_TEXT, function(node) {
    if(!node.nodeValue) {
      node.remove();
    }
  });

  const elements = document.getElementsByTagName('*');
  const scores = new Map();
  elements.forEach(element => scores.set(element, 0));

  // Collect node text lengths
  const textLengths = deriveTextLengths(document);

  // Collect non-nominal anchor text lengths
  const anchors = document.querySelectorAll('a[href]');
  const anchorLengths = anchors.reduce(function (map, anchor) {
    const length = textLengths.get(anchor);
    const ancestors = getAncestors(anchor);
    if(length) {
      return [anchor].concat(ancestors).reduce(function(map, element) {
        return map.set(element, (map.get(element) || 0) + length);
      }, map);
    } else {
      return map;
    }
  }, new Map());

  // Apply text bias to each element
  elements.forEach(function(element) {
    const bias = getTextBias(element, textLengths, 
      anchorLengths);
    if(bias) {
      scores.set(element, scores.get(element) + bias);
      setAnnotation(element, 'textBias', bias.toFixed(2));
    }
  });

  // Apply intrinsic bias to each element
  elements.forEach(function(element) {
    const bias = INTRINSIC_BIAS.get(element.localName);
    if(bias) {
      setAnnotation(element, 'intrinsicBias', bias);
      scores.set(element, scores.get(element) + bias);
    }
  });

  // Pathological case for single articles
  const articles = document.getElementsByTagName('article');
  if(articles.length === 1) {
    scores.set(articles[0], scores.get(articles[0]) + 1000);
    setAnnotation(articles[0], 'intrinsicBias', 1000);
  }

  // Penalize list descendants
  // TODO: this is bugged, not accumulating bias from other ancestors
  const listSelector = 'li *, ol *, ul *, dd *, dl *, dt *';
  document.querySelectorAll(listSelector).forEach(function(element) {
    scores.set(element, scores.get(element) - 100);
    setAnnotation(element, 'listItemBias', -100);
  });

  // Penalize descendants of navigational elements
  const navSelector = 'aside *, header *, footer *, nav *';
  document.querySelectorAll(navSelector).forEach(function(element) {
    scores.set(element, scores.get(element) - 50);
    if(element.dataset) {
      setAnnotation(element, 'navigationItemBias', 
        parseInt(element.dataset.navigationItemBias || '0') - 50);
    }
  });

  // Bias the parents of certain elements
  elements.forEach(function(element) {
    const bias = DESCENDANT_BIAS.get(element.localName);
    if(bias) {
      const parent = element.parentElement;
      setAnnotation(parent, 'descendantBias', parseInt(
        parent.dataset.descendantBias || '0') + bias);
      scores.set(parent, scores.get(parent) + bias);      
    }
  });

  // Bias image containers
  document.querySelectorAll('img').forEach(function(image) {
    const parent = image.parentElement;
    const bias = getCarouselBias(image) + 
      getImageDescriptionBias(image) + 
      getImageDimensionBias(image);
    if(bias) {
      setAnnotation(parent, 'imageBias', bias);
      scores.set(parent, scores.get(parent) + bias);      
    }
  });

  // Bias certain elements based on their attributes
  // TODO: itemscope?
  // TODO: itemprop="articleBody"?
  // TODO: [role="article"]?
  const biasedElementsWithAttributesSelector = 
    'a, aside, div, dl, figure, h1, h2, h3, h4,' +
    ' ol, p, section, span, ul';
  document.querySelectorAll(
    biasedElementsWithAttributesSelector).forEach(function(element) {
    const bias = getAttributeBias(element);
    setAnnotation(element, 'attributeBias', bias);
    scores.set(element, scores.get(element) + bias);
  });

  function applySingleClassBias(className, bias) {
    const elements = document.getElementsByClassName(className);
    if(elements.length === 1) {
      scores.set(elements[0], scores.get(elements[0]) + bias);
      setAnnotation(elements[0], 'attributeBias', bias);
    }
  }

  applySingleClassBias('article', 1000);
  applySingleClassBias('articleText', 1000);
  applySingleClassBias('articleBody', 1000);

  // Item types
  ITEM_TYPES.forEach(function(schema) {
    const elements = document.querySelectorAll('[itemtype="' + 
      schema + '"]');
    if(elements.length === 1) {
      scores.set(elements[0], scores.get(elements[0]) + 500);
      setAnnotation(elements[0], 'itemTypeBias', 500);
    }
  });

  // Annotate element scores
  if(annotate) {
    elements.forEach(function(element) {
      const score = scores.get(element);
      if(score) {
        element.dataset.score = score.toFixed(2);
      }
    });    
  }

  // Find the best element
  let bestElement = document.body;
  let bestElementScore = scores.get(bestElement);
  elements.forEach(function(element) {
    const score = scores.get(element);
    if(score > bestElementScore) {
      bestElement = element;
      bestElementScore = score;
    }
  });

  // Remove non-intersecting elements
  // TODO: use Node.compareDocumentPosition
  elements.filter(function(element) {
    return element !== bestElement && 
      !bestElement.contains(element) && 
      !element.contains(bestElement);
  }).forEach(remove);

  // Transform javascript anchors into nominal anchors
  document.querySelectorAll('a[href]').filter(
    isJavascriptAnchor).forEach(function(anchor) {
    anchor.removeAttribute('href');
  });

  // Unwrap nominal anchors
  document.querySelectorAll('a:not([href])').forEach(unwrap);

  // Unwrap unwrappable elements
  // TODO: experiment with querySelectorAll?
  for(let element = document.querySelector(UNWRAPPABLE_ELEMENTS),
    iterations = 0; element && (iterations < 3000); 
    element = document.querySelector(UNWRAPPABLE_ELEMENTS), 
    iterations++) {
    unwrap(element);
  }

  // Remove attributes
  removeAttributes(document);
  elements.forEach(removeAttributes);
  removeLeaves(document);

  // Replace lists with one item with the item's content
  document.getElementsByTagName('ul').forEach(function(list) {
    const itemCount = getListItemCount(list);
    if(itemCount === 1) {
      unwrapList(list);
    }
  });

  { // start trim block
    let sibling = bestElement;
    let node = bestElement.firstChild;
    while(isTrimmableElement(node)) {
      sibling = node.nextSibling;
      console.debug('Trimming %o from front of bestElement', node);
      node.remove();
      node = sibling;
    }

    node = bestElement.lastChild;
    while(isTrimmableElement(node)) {
      sibling = node.previousSibling;
      console.debug('Trimming %o from end of bestElement', node);
      node.remove();
      node = sibling;
    }
  } // end trim block
} // END transform function

// Export transform function
Calamine.transform = transform;

function canonicalizeWhitespace(node) {
  node.nodeValue = node.nodeValue.replace(/\s/g, ' ');
}

function deriveTextLengths(document) {
  const map = new Map();
  document.forEachNode(NodeFilter.SHOW_TEXT, function(node) {
    while(node) {
      const length = node.nodeValue.length;
      if(length) {
        node = node.parentNode;
        while(node) {
          map.set(node, (map.get(node) || 0) + length);
          node = node.parentNode;
        }
      }
    }
  });
  return map;
}

function isJavascriptAnchor(anchor) {
  const href = anchor.getAttribute('href');
  return /^\s*javascript\s*:/i.test(href);
}

function getListItemCount(list) {
  return reduce.call(list.childNodes, function(count, node) {
    return count + (node.localName === 'li' ? 1 : 0);
  }, 0);
}

function unwrapList(list) {
  //console.debug('Unwrapping list %s', list.parentElement.innerHTML);
  const parent = list.parentElement;
  const item = list.querySelector('li');
  const nextSibling = list.nextSibling;

  if(nextSibling) {
    // Move the item's children to before the list's 
    // next sibling
    while(item.firstChild) {
      parent.insertBefore(item.firstChild, nextSibling);
    }
  } else {
    // The list is the last node in its container, so append
    // the item's children to the container
    while(item.firstChild) {
      parent.appendChild(item.firstChild);
    }
  }

  list.remove();
}

function isTrimmableElement(element) {
  if(!element) return false;
  if(element.nodeType !== Node.ELEMENT_NODE) return false;
  let name = element.localName;
  if(name === 'br') return true;
  if(name === 'hr') return true;
  if(name === 'p' && !element.firstChild) return true;
  return false;
}

function removeAttributes(element) {
  if(element) {
    const attributes = element.attributes;
    if(attributes) {
      let index = attributes.length;
      while(index--) {
        let name = attributes[index].name;
        if(name !== 'href' && name !== 'src') {
          element.removeAttribute(name);
        }
      }
    }
  }
}

// TODO: element.offsetWidth < 1 || element.offsetHeight < 1; ?
function isHidden(element) {
  if(element.localName === 'noscript' || element.localName === 'noembed') {
    return false;
  }
  const style = element.style;
  if(style.display === 'none' || style.visibility === 'hidden' || 
    style.visibility === 'collapse') {
    return true;
  }
  const opacity = parseFloat(style.opacity);
  return opacity < 0.3;
}

// Adapted from "Boilerplate Detection using Shallow Text Features". 
// See http://www.l3s.de/~kohlschuetter/boilerplate
// For better performance, we use character counts instead of word
// counts.
function getTextBias(element, textLengths, anchorLengths) {
  const textLength = textLengths.get(element);
  let bias = 0;
  if(textLength) {
    const anchorLength = anchorLengths.get(element) || 0;
    bias = (0.25 * textLength) - (0.7 * anchorLength);
    // Tentative cap
    bias = Math.min(4000, bias);      
  }

  return bias;
}

function getImageDimensionBias(image) {
  let bias = 0;
  if(image.width && image.height) {
    const area = image.width * image.height;
    bias = 0.0015 * Math.min(100000, area);
  }
  return bias;
}

// TODO: check data-alt and data-title?
function getImageDescriptionBias(image) {
  if(image.getAttribute('alt') || image.getAttribute('title') || 
    findCaption(image)) {
    return 30;
  }
  return 0;
}

function getCarouselBias(image) {
  const parent = image.parentElement;
  if(!parent) {
    return 0;
  }
  return reduce.call(parent.childNodes, function(bias, node) {
    if(node !== image && node.localName === 'img') {
      return bias - 50;
    } else {
      return bias;
    }
  }, 0);
}

// TODO: split on case-transition (lower2upper,upper2lower)
// and do not lower case the value prior to the split, do it after
function tokenize(value) {
  const tokens = value.toLowerCase().split(/[\s\-_0-9]+/g);
  return ArrayUtils.unique(tokens.filter(identity));
}

function getAttributeBias(element) {
  const values = [
    element.getAttribute('id'),
    element.getAttribute('name'),
    element.getAttribute('class'),
    element.getAttribute('itemprop')
  ].filter(identity);
  const tokens = tokenize(values.join(' '));
  return tokens.reduce(function(sum, value) {
    return sum + (ATTRIBUTE_BIAS.get(value) || 0);
  }, 0);
}

// Return true if image missing source or tracer-like
// TODO: cleanup redundant conditions, research how Chrome sets properties
// from attributes, and the data type of those properties (string or int?)
function isTracer(image) {
  const source = image.getAttribute('src');
  const width = image.getAttribute('width');
  const height = image.getAttribute('height');
  return !source || !source.trim() || 
    width === '0' || width === '0px' || width === '1' ||
    height === '1px' || height === '1' || 
    image.width === 0 || image.width === 1 || 
    image.height === 0 || image.height === 1;
}

// NOTE: not optimized for live documents
function unwrap(element) {
  const parent = element.parentElement;
  if(parent) {
    while(element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    element.remove();
  }
}

function remove(element) {
  element.remove();
}

function findCaption(image) {
  const parents = getAncestors(image);  
  const figure = parents.find(e => {
    return e.matches('figure')
  });
  if(figure)
    return figure.querySelector('figcaption');
}

function getAncestors(element) {
  const parents = [];
  let parent = element.parentElement;
  while(parent) {
    parents.push(parent);
    parent = parent.parentElement;
  }
  return parents;
}

function identity(value) {
  return value;
}

function isElement(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}

function isInlineElement(element) {
  return INLINE_ELEMENTS.has(element.localName);
}

function setDatasetProperty(element, propertyName, value) {
  element.dataset[propertyName] = value;
}

function noop() {}

function trimTextNodes(document) {
  const elements = document.querySelectorAll(
    WHITESPACE_SENSITIVE_ELEMENTS);

  // TODO: improve
  const preformatted = new Set(
    Array.prototype.slice.call(elements.internal));

  const iterator = document.createNodeIterator(document.documentElement, 
    NodeFilter.SHOW_TEXT);
  let node = document.documentElement;

  // todo: set node separatey instead in while loop condition for better style
  while(node = iterator.nextNode()) {
    if(preformatted.has(node.parentElement)) {
      continue;
    }

    if(node.previousSibling) {
      if(isElement(node.previousSibling)) {
        if(isInlineElement(node.previousSibling)) {
          if(node.nextSibling) {
            if(isElement(node.nextSibling)) {
              if(!isInlineElement(node.nextSibling)) {
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
            if(isInlineElement(node.nextSibling)) {
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
        if(isInlineElement(node.nextSibling)) {
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

const LEAF_EXCEPTIONS = ['area', 'audio', 'br', 'canvas', 'col',
  'hr', 'img', 'source', 'svg', 'track', 'video'].join(',');

function removeLeaves(document) {

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

  const elements = document.getElementsByTagName('*');
  const leaves = elements.filter(function(element) {
    return !element.firstChild && !element.matches(LEAF_EXCEPTIONS);
  });
  const parents = leaves.map(function(element) {
    const parent = element.parentElement;
    element.remove();
    return parent;
  });
  const stack = parents.filter(function(document, element) {
    // TODO: why test for document.body per iteration?

    // TODO: somehow observed an undefined document, need to look
    // into how that could possibly happen
    if(document) {
      return document.body && document.body != element;        
    }
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
    if(!grandParent || grandParent === document.body || 
      grandParent === document.documentElement) {
      continue;
    }

    stack.push(grandParent);
  }
}

const INTRINSIC_BIAS = new Map([
  ['article', 200],
  ['main', 100],
  ['section', 50],
  ['blockquote', 10],
  ['code', 10],
  ['content', 200],
  ['div', 200],
  ['figcaption', 10],
  ['figure', 10],
  ['ilayer', 10],
  ['layer', 10],
  ['p', 10],
  ['pre', 10],
  ['ruby', 10],
  ['summary', 10],
  ['a', -500],
  ['address', -5],
  ['dd', -5],
  ['dt', -5],
  ['h1', -5],
  ['h2', -5],
  ['h3', -5],
  ['h4', -5],
  ['h5', -5],
  ['h6', -5],
  ['small', -5],
  ['sub', -5],
  ['sup', -5],
  ['th', -5],
  ['form', -20],
  ['li', -50],
  ['ol', -50],
  ['ul', -50],
  ['font', -100],
  ['aside', -100],
  ['header', -100],
  ['footer', -100],
  ['table', -100],
  ['tbody', -100],
  ['thead', -100],
  ['tfoot', -100],
  ['nav', -100],
  ['tr', -500]
]);

const DESCENDANT_BIAS = new Map([
  ['a', -5],
  ['blockquote', 20],
  ['div', -50],
  ['figure', 20],
  ['h1', 10],
  ['h2', 10],
  ['h3', 10],
  ['h4', 10],
  ['h5', 10],
  ['h6', 10],
  ['li', -5],
  ['ol', -20],
  ['p', 100],
  ['pre', 10],
  ['ul', -20]
]);

const ATTRIBUTE_BIAS = new Map([
  ['about', -35],
  ['ad', -100],
  ['ads', -50],
  ['advert', -200],
  ['artext1',100],
  ['articles', 100],
  ['articlecontent', 1000],
  ['articlecontentbox', 200],
  ['articleheadings', -50],
  ['articlesection', 200],
  ['articlesections', 200],
  ['attachment', 20],
  ['author', 20],
  ['block', -5],
  ['blog', 20],
  ['blogpost', 500], // Seen as itemprop value
  ['blogposting', 500],
  ['body', 100],
  ['bodytd', 50],
  ['bookmarking', -100],
  ['bottom', -100],
  ['brand', -50],
  ['breadcrumbs', -20],
  ['button', -100],
  ['byline', 20],
  ['caption', 10],
  ['carousel', 30],
  ['cmt', -100],
  ['cmmt', -100],
  ['colophon', -100],
  ['column', 10],
  ['combx', -20],
  ['comic', 75],
  ['comment', -500],
  ['comments', -300],
  ['commercial', -500],
  ['community', -100],
  ['complementary', -100], // Seen as role
  ['component', -50],
  ['contact', -50],
  ['content', 100],
  ['contentpane', 200], // Google Plus
  ['contenttools', -50],
  ['contributors', -50],
  ['credit', -50],
  ['date', -50],
  ['dcsimg', -100],
  ['dropdown', -100],
  ['email', -100],
  ['entry', 100],
  ['excerpt', 20],
  ['facebook', -100],
  ['featured', 20],
  ['fn', -30],
  ['foot', -100],
  ['footer', -200],
  ['footnote', -150],
  ['ftr', -100],
  ['ftrpanel', -100],
  ['google', -50],
  ['gutter', -300],
  ['guttered', -100],
  ['head', -50],
  ['header', -100],
  ['heading', -50],
  ['hentry', 150],
  ['hnews', 200],
  ['inset', -50],
  ['insta', -100],
  ['left', -75],
  ['legende', -50],
  ['license', -100],
  ['like', -100],
  ['link', -100],
  ['links', -100],
  ['logo', -50],
  ['main', 50],
  ['mainbodyarea', 100],
  ['maincolumn', 50],
  ['mainnav', -500],
  ['mainnavigation', -500],
  ['masthead', -30],
  ['media', -100],
  ['mediaarticlerelated', -50],
  ['menu', -200],
  ['menucontainer', -300],
  ['meta', -50],
  ['most', -50],
  ['nav', -200],
  ['navbar', -100],
  ['navigation', -100],
  ['navimg', -100],
  ['newsarticle', 500],
  ['newscontent', 500],
  ['newsletter', -100],
  ['next', -300],
  ['nfarticle', 500],
  ['page', 50],
  ['pagetools', -50],
  ['parse', -50],
  ['pinnion', 50],
  ['popular', -50],
  ['popup', -100],
  ['post', 150],
  ['power', -100],
  ['prev', -300],
  ['print', -50],
  ['promo', -200],
  ['promotions', -200],
  ['ranked', -100],
  ['reading', 100],
  ['recap', -100],
  ['recreading', -100],
  ['rel', -50],
  ['relate', -300],
  ['related', -300],
  ['relposts', -300],
  ['replies', -100],
  ['reply', -50],
  ['retweet', -50],
  ['right', -100],
  ['rightcolumn', -100],
  ['rightrail', -100],
  ['scroll', -50],
  ['share', -200],
  ['sharebar', -200],
  ['shop', -200],
  ['shout', -200],
  ['shoutbox', -200],
  ['side', -200],
  ['sig', -50],
  ['signup', -100],
  ['snippet', 50],
  ['social', -200],
  ['socialnetworking', -250],
  ['socialtools', -200],
  ['source',-50],
  ['sponsor', -200],
  ['story', 100],
  ['storycontent', 500],
  ['storydiv',100],
  ['storynav',-100],
  ['storytext', 200],
  ['storytopbar', -50],
  ['storywrap', 50],
  ['strycaptiontxt', -50],
  ['stryhghlght', -50],
  ['strylftcntnt', -50],
  ['stryspcvbx', -50],
  ['subscribe', -50],
  ['summary',50],
  ['tabs', -100],
  ['tag', -100],
  ['tagcloud', -100],
  ['tags', -100],
  ['teaser', -100],
  ['text', 20],
  ['this', -50],
  ['time', -30],
  ['timestamp', -50],
  ['title', -50],
  ['tool', -200],
  ['topheader', -300],
  ['toptabs', -200],
  ['twitter', -200],
  ['txt', 50],
  ['utility', -50],
  ['vcard', -50],
  ['week', -100],
  ['welcome', -50],
  ['widg', -200],
  ['widget', -200],
  ['wnstorybody', 1000],
  ['zone', -50]
]);

const ITEM_TYPES = [
  'http://schema.org/Article',
  'http://schema.org/Blog',
  'http://schema.org/BlogPost',
  'http://schema.org/BlogPosting',
  'http://schema.org/NewsArticle',
  'http://schema.org/ScholarlyArticle',
  'http://schema.org/TechArticle',
  'http://schema.org/WebPage'
];

const INLINE_ELEMENTS = new Set(['a','abbr', 'acronym', 'address',
  'b', 'bdi', 'bdo', 'blink','cite', 'code', 'data', 'del',
  'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'mark', 'map',
  'meter', 'q', 'rp', 'rt', 'samp', 'small', 'span', 'strike',
  'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var'
]);

const WHITESPACE_SENSITIVE_ELEMENTS = 'code, code *, pre, pre *, ' + 
  'ruby, ruby *, textarea, textarea *, xmp, xmp *';

const UNWRAPPABLE_ELEMENTS = [
  'article', 'big', 'blink', 'body', 'center', 'colgroup', 'data', 
  'details', 'div', 'font', 'footer', 'form', 'header', 'help',
  'hgroup', 'ilayer', 'insert', 'label', 'layer', 'legend', 'main',
  'marquee', 'meter', 'multicol', 'nobr', 'noembed', 'noscript',
  'plaintext', 'section', 'small', 'span', 'tbody', 'tfoot', 
  'thead', 'tt'
].join(',');

// NOTE: cannot use 'div.share'
// NOTE: cannot use 'article div.share' (Vanity Fair vs Concurring Opinions)
// NOTE: cannot use 'div.posts', (wordpress copyblogger theme)
// NOTE: cannot use 'div.menu', // CNBC

const BLACKLIST_SELECTORS = [
  'a.advertise-with-us', // The Daily Voice
  'a.aggregated-rel-link', // The Oklahoman
  'a.bylineCommentCount', // Pasadena Star News
  'a.carousel-control', // The Miami Herald
  'a.commentLink', // Salt Lake Tribune
  'a.comments', // Good Magazine
  'a.detail-newsletter-trigger', // The Daily Voice
  'a.dsq-brlink', // USA Today
  'a.enlargebtn', // NPR
  'a.hdn-analytics', // SF Gate
  'a[href^="http://ad.doubleclick"]', // Medium
  'a[href*="socialtwist"]', // The Jewish Press
  'a.image-component__pinterest', // Huffington Post
  'a.meta-comments', // Windows Central
  'a.modal-trigger', // NY Post
  'a.more-tab', // The Oklahoman
  'a.nextPageLink', // Salt Lake Tribune
  'a.post_cmt1', // Times of India
  'a.readmore-link', // Topix
  'a[rel="tag"]', // // The Oklahoman
  'a.twitter-follow-button', // Ha'Aretz
  'a.twitter-share-button', // The Jewish Press
  'a.twitter-timeline', // Newsday
  'a.synved-social-button', // Viral Global News
  'a.skip-to-text-link', // NYTimes
  'applet',
  'article div.extra', // Washington Post
  'article > div.tags', // NPR
  'article ul.listing', // Good Magazine
  'aside.author-blocks', // ProPublica
  'aside.itemAsideInfo', // The Guardian
  'aside#asset-related', // St. Louis Today
  'aside.bg-related', // The Boston Globe
  'aside#bpage_ad_bottom', // BuzzFeed
  'aside[data-panelmod-type="relatedContent"]', // LA Times
  'aside.callout', // The Atlantic
  'aside.entry-sidebar', // The Globe
  'aside#fbookulous-flyer', // ProPublica
  'aside.global-magazine-recent', // Politico
  'aside.global-popular', // Politico
  'aside.inset-section',// Techcrunch
  'aside.karma', // Swissinfo.ch
  'aside.like-this', // ProPublica
  'aside.livefyre-comments', // Vanity Fair
  'aside.meta_extras', // Japan Times
  'aside.marginalia', // NY Times
  'aside.mashsb-container', // cryptocoinsnews.com
  'aside.module-2013-follow', // ProPublica
  'aside.module-tabbed-2011', // ProPublica
  'aside#post_launch_success', // BuzzFeed
  'aside.prev-next', // The Economist
  'aside.referenced-wide', // Gawker
  'aside.related-articles', // BBC
  'aside.related-content', // // The Oklahoman
  'aside#related-content-xs', // The Miami Herald
  'aside.related-side', // NY Magazine
  'aside.right-rail-module', // Time
  'aside#secondary-rail', // Dispatch.com
  'aside.see-also', // The Root
  'aside#sidebar', // TechSpot
  'aside#sidebar-read-more', // USA Today
  'aside.slickshare', // ProPublica
  'aside.social-stack', // ProPublica
  'aside#story-related-topics', // AV Web
  'aside.story-right-rail', // USA Today
  'aside.story-supplement', // Politico
  'aside.tools', // The Boston Globe
  'aside.vestpocket', // Forbes
  'aside.views-tags', // BuzzFeed
  'aside.widget-area', // thedomains.com
  'b.toggle-caption', // NPR
  'base',
  'basefont',
  'bgsound',
  'button',
  'command',
  'fb\\:comments',
  'datalist',
  'dialog',
  'div#a-all-related', // New York Daily News
  'div.about-the-author', // SysCon Media
  'div.actions-panel', // SysCon Media
  'div.ad', // Reuters
  'div.adAlone300', // The Daily Herald
  'div.adarea', // Telegraph
  'div.ad-cluster-container', // TechCrunch
  'div.ad-container', // Fox News
  'div.additional-stories', // Vanity Fair
  'div.addthis_toolbox', // NobelPrize.org
  'div.addtoany_share_save_container', // Global Dispatch
  'div.adCentred', // The Sydney Morning Herald
  'div.adjacent-entry-pagination', // thedomains.com
  'div#addshare', // The Hindu
  'div.admpu', // Telegraph UK
  'div.adsense', // Renew Economy
  'div.ad-unit', // TechCrunch
  'div.advertisementPanel', // TV New Zealand
  'div.am-ctrls', // Investors.com
  'div[aria-label="+1 this post"]', // Google Plus
  'div.artbody > div.share', // China Topix
  'div.art_tabbed_nav', // The Wall Street Journal (blog)
  'div.articleAutoFooter', // NECN
  'div.article div.columnsplitter', // CTV News
  'div#article div.share', // timeslive.co.za
  'div.article div.short-url', // Politico
  'div.article div.tags', // Politico
  'div.article div#media', // Newsday
  'div.article_actions', // Forbes
  'div.article-actions', // Ottawa Citizen
  'div.article_cat', // Collegian
  'div#article_comments', // Fort Worth Star Telegram
  'div.article_comments', // Voice of America
  'div.article-comments', // Times of India
  'div.articleComments', // Reuters
  'div#articleIconLinksContainer', // The Daily Mail
  'div.article-social', // Fortune Magazine
  'div.articleEmbeddedAdBox', // Mercury News
  'div.article-extra', // TechCrunch
  'div.article-footer', // Windows Central
  'div.article_footer', // Bloomberg
  'div.article_interaction', // Bloomberg
  'div[data-vr-zone="You May Like"]', // Voice of America
  'div.article-list', // // The Oklahoman
  'div#articleKeywords', // The Hindu
  'div.articleMeta', // Tampa Bay
  'div.articleOptions', // Mercury News
  'div#articlepagerreport', // Chron.com
  'div.article-pagination', // UT San Diego
  'div.article-print-url', // USA Today
  'div.articleRelates', // Baltimore Sun
  'div.articleServices', // Ha'Aretz
  'div.articleShareBottom', // Fox Sports
  'div.article-side', // The Times
  'div.article_share', // NBC News
  'div.article_social', // Bloomberg
  'div.article-social-actions', // Windows Central
  'div.articleSponsor', // Telegraph Co Uk
  'div.article-tags', // entrepeneur.com
  'div.article-text div.fullArticle', // Intl Business Times UK
  'div.article-tips', // 9News
  'div.articleTools', // Reuters
  'div.article-tools', // The Atlantic
  'div.article-tools-horizontal', // Wharton Knowledge Blog
  'div.article-utilities', // Sports Illustrated
  'div.articleViewerGroup', // Mercury News
  'div.artOtherNews', // Investors.com
  'div.aside-related-articles', // Techcrunch
  'div.assetBuddy', // Reuters
  'div.at-con', // Design & Trend
  'div.at-next', // Design & Trend
  'div.at-tag', // Design & Trend
  'div.at-tool', // Design & Trend
  'div#authorarea', // Global Dispatch
  'div#author-byline', // NY Post
  'div.author_topics_holder', // The Irish Times
  'div.author-wrap', // Recode
  'div.author-info', // Streetwise
  'div[data-ng-controller="bestOfMSNBCController"]', // MSNBC
  'div.big_story_tools_bottom_container', // Alternet
  'div.bio-socials', // Atomic Object
  'div.bizPagination', // Bizjournal
  'div.bk-socialbox', // Latin Post
  'div.bk-relart', // Latin Post
  'div#blq-foot', // BBC
  'div#block-disqus-disqus_comments', // Foreign Affairs
  'div#block-fa-cfrlatest', // Foreign Affairs
  'div#block-fa-related', // Foreign Affairs
  'div#blog-sidebar', // Comic Book Resources
  'div#blox-breadcrumbs', // Joplin
  'div#blox-comments', // National Standard
  'div#blox-footer', // Joplin
  'div#blox-header', // Joplin
  'div#blox-right-col', // Joplin
  'di#blox-breadcrumbs', // Joplin
  'div.bookmarkify', // Kamens Blog
  'div#bottom-rail', // Vanity Fair
  'div.bottom_subscribe', // Alternet
  'div.bpcolumnsContainer', // Western Journalism
  'div#breadcrumb', // Autonews
  'div.breadcrumb_container', // NBC News
  'div#breadcrumbs', // E-Week
  'div.breadcrumbs', // Scientific American
  'div.browse', // ABC News
  'div.bt-links', // Learning and Finance
  'div[bucket-id="most_popular_01"]', // Telegraph/Reuters
  'div[bucket-id="secondary_navigation_01"]', // Telegraph/Reuters
  'div.buying-option', // Times of India
  'div.byline', // Misc, but the only way to identify Autonews
  'div.byline_links', // Bloomberg
  'div.bylineSocialButtons', // Telegraph Co Uk
  'div.byline-wrap', // The Wall Street Journal
  'div.card-stats', // WFPL
  'div.category-nav', // Sparkfun
  'div#ce-comments', // E-Week
  'div#CM-notification-unit', // The New Yorker (paywall notice)
  'div.cmtLinks', // India Times
  'div.cnn_strybtntools', // CNN
  'div.cnn_strylftcntnt', // CNN
  'div.cnn_strycntntrgt', // CNN
  'div.cn_reactions_comments', // Vanity Fair
  'div#commentary', // Autonews
  'div#comment_bar', // Autonews
  'div#commentBar', // Newsday
  'div.comment_bug', // Forbes
  'div#comment-container', // auburnpub.com
  'div#commentblock', // Learning and Finance
  'div#commentBlock', // NPR
  'div.commentCount', // Reuters
  'div.comment-count', // auburnpub.com
  'div.comment-count-block',// TechSpot
  'div.comment_count_affix', // // The Oklahoman
  'div.commentDisclaimer', // Reuters
  'div.comment-holder', // entrepeneur.com
  'div#commenting', // Fox News
  'div#commentLink', // // The Oklahoman
  'div#comment-list', // Bangkok Post
  'div.CommentBox', // LWN
  'div#comment-reply-form', // Sparkfun
  'div#comments', // CBS News
  'div.comments', // TechCrunch
  'div.comments-box', // Freakonomics
  'div.comments-component', // Huffington Post
  'div#commentslist', // The Jewish Press
  'div#comment_sign', // Ace Showbiz
  'div#comments-tabs', // Houston News
  'div.commentThread', // kotatv
  'div#comment_toggle', // Charlotte Observer
  'div.comment-tools', // Latin post
  'div.comment_links', // Forbes
  'div.comments-overall', // Aeon Magazine
  'div#commentpolicy', // PBS
  'div.comment-policy-box', // thedomains.com
  'div#commentPromo', // Salt Lake Tribune
  'div.commentWrap', // Corcodillos
  'div.component-share', // Sports Illustrated
  'div#content-below', // SysCon Media
  'div.content_column2_2', // VOA News
  'div.content-tools', // Time Magazine
  'div.contribution-stats-box', // Knight News Challenge
  'div.control-bar', // SF Gate
  'div.controls', // NY Daily News
  'div.correspondant', // CBS News
  'div.correspondent-byline', // BBC Co Uk
  'div.cqFeature', // Vanity Fair
  'div.css-sharing', // Topix
  'div#ctl00_ContentPlaceHolder1_UC_UserComment1_updatePanelComments', // Ahram
  'div#dailydot-socialbar', // Daily Dot
  'div[data-module-zone="articletools_bottom"]', // The Wall Street Journal
  'div[data-ng-controller="moreLikeThisController"]', // MSNBC
  'div.deep-side-opinion', // The Australian
  'div.dfad', // thedomains.com
  'div.dfinder_cntr', // Hewlett Packard News
  'div#dfp-ad-mosad_1-wrapper', // The Hill
  'div#digital-editions', // The New Yorker
  'div#disqus', // ABCNews
  'div#disqusAcc', // Telegraph Co Uk
  'div#disqus_comments_section', // Herald Scotland
  'div#disqus_thread', // Renew Economy
  'div.dmg-sharing', // Dispatch.com
  'div.editorsChoice', // Telegraph Co Uk
  'div.editorsPick', // India Times
  'div.editors-picks', // The Wall Street Journal
  'div.email-optin', // Quantstart
  'div#email-sign-up', // BBC
  'div.email-signup', // entrepeneur.com
  'div.embedded-hyper', // BBC
  'div.encrypted-content', // Atlantic City Press
  'div.endslate', // WFMY News (final slide element)
  'div.entity_popular_posts', // Forbes
  'div.entity_preview', // Forbes
  'div.entity_recent_posts', // Forbes
  'div.entry-listicles', // CBS
  'div.entry-meta', // Re-code (uncertain about this one)
  'div.entry-related', // The Globe
  'div#entry-tags', // hostilefork
  'div.entry-tags', // Wired.com
  'div.entry-toolbar', // CBS
  'div.entry-unrelated', // The New Yorker
  'div#epilogue', // hostilefork
  'div.essb_links', // Beta Wired
  'div#et-sections-dropdown-list', // The Washington Post
  'div#external-source-links', // Daily Mail UK
  'div.extra-services', // ARXIV
  'div.fb-content', // The Week
  'div.fblike', // Ha'Aretz
  'div.feature-btns', // USA Today (assumes video not supported)
  'div.feature_nav', // E-Week
  'div#features', // BBC News
  'div.field-name-field-tags', // WFPL
  'div.first-tier-social-tools', // Time Magazine
  'div.floating-share-component', // Huffington Post
  'div.followable_block', // Forbes
  'div.follow-authors', // Politico
  'div.follow-us', // Fox News
  'div.follow-us-component', // Huffington Post
  'div.follow-us-below-entry-component', // Huffington Post
  'div.footer', // KMBC
  'div#footer', // Newsday
  'div.footerlinks', // VOA News
  'div#forgotPassword', // Joplin Globe
  'div#forgotPasswordSuccess', // Joplin Globe
  'div.further-reading', // ProPublica
  'div.gallery-sidebar-ad', // USA Today
  'div.gallery-overlay-outter', // SF Gate
  'div#gkSocialAPI', // The Guardian
  'div.googleads', // Telegraph UK
  'div.group-link-categories', // Symmetry Magazine
  'div.group-links', // Symmetry Magazine
  'div.gsharebar', // entrepeneur.com
  'div#guidelines-wrap', // Charlotte Observer
  'div.hashtags', // Good Magazine
  'div.headlines', // // The Oklahoman
  'div.headlines-images', // ABC 7 News
  'div.hide-for-print', // NobelPrize.org
  'div.horiz_con', // ABC22NOW
  'div#hsa_container', // Star Advertiser
  'div.hst-articlefooter', // Chron.com
  'div.hst-articletools', // Chron.com
  'div.hst-blockstates', // Stamford Advocate (may be problematic)
  'div.hst-featurepromo', // Seattle Pi
  'div.hst-freeform', // Chron.com
  'div.hst-headlinelist', // Chron.com
  'div.hst-hottopics', // Chron.com
  'div.hst-modularlist', // Chron.com
  'div.hst-morestories', // Chron.com
  'div.hst-mostpopular', // Seattle Pi
  'div.hst-newsgallery', // Stamford Advocate
  'div.hst-othernews', // Stamford Advocate
  'div.hst-relatedlist', // Seattle Pi
  'div.hst-simplelist', // Chron.com
  'div.hst-siteheader', // Seattle Pi
  'div.hst-slideshowpromo', // Seattle Pi
  'div.htzTeaser', // Ha'Aretz
  'div.huffpost-adspot', // Huffington Post
  'div.huffpost-recirc', // Huffington Post
  'div.ib-collection', // KMBC
  'div.icons', // Brecorder
  'div.icons_inner', // Ahram
  'div#infinite-list', // The Daily Mail
  'div#inlineAdCont', // Salt Lake Tribune
  'div.inline-sharebar', // CBS News
  'div.inline-share-tools-asset', // USA Today
  'div.inline-related-links', // Gourmet.com
  'div.inner-related-article', // Recode
  'div#inset_groups', // Gizmodo
  'div.insettwocolumn', // NPR
  'div.insideStoryAd', // Star Advertiser
  'div.interactive-sponsor', // USA Today
  'div.issues-topics', // MSNBC
  'div[itemprop="comment"]',// KMBC
  'div#jp-relatedposts', // IT Governance USA
  'div.j_social_set', // MSNBC (embedded share links)
  'div#latest-by-section', // Houston News
  'div.latest-stories', // Vanity Fair
  'div.LayoutSocialTools', // ecdc.europa.eu
  'div.LayoutTools', // ecdc.europa.eu
  'div#leader', // hostilefork
  'div.lhs_relatednews', // NDTV
  'div.like-share', // Bangkok Post
  'div.likeus', // Good Magazine
  'div.linearCalendarWrapper', // ABC News
  'div.link-list-inline', // Las Vegas Sun
  'div#livefyre-wrapper', // The Wall Street Journal
  'div.ljcmt_full', // LiveJournal
  'div.ljtags', // LiveJournal
  'div.load-comments', // entrepeneur.com
  'div.l-sidebar', // TechSpot
  'div.l-story-secondary', // Boston.com
  'div.k-g-share', // bbc.co.uk
  'div.main > div#rail', // Fox News
  'div#main-content > div.share', // Knight News Challenge
  'div.main_social', // Times of India
  'div#main div#secondary', // Newsday
  'div.m-article__share-buttons', // The Verge
  'div.mashsharer-box', // internetcommerce.org
  'div.m-entry__sidebar', // The Verge
  'div#mergeAccounts', // Joplin Globe
  'div.meta_bottom', // Collegian
  'div#metabox', // Global Dispatch
  'div.meta-container', // Gawker
  'div#meta-related', // Entertainment Weekly
  'div#mc_embed_signup', // stgeorgeutah.com
  'div.m-linkset', // The Verge
  'div.middle-ads', // The Times
  'div.minipoll', // Topix
  'div.mla_cite', // NobelPrize.org
  'div.mmn-link', // ABC 7 News
  'div.mobile-button', // Ha'Aretz
  'div.modComments', // Investors.com
  'div#module-recirculation-speedreads',// The Week Left side
  'div.module__biz-pulse', // Bizjournal
  'div.mod-video-playlist', // ESPN
  'div#more-on', // NY Post
  'div.more-single', // USA Today
  'div.moreweb', // Uptown Magazine
  'div#most-popular', // BBC
  'div.most-popular', // Vanity Fair
  'div.most-popular-container', // The Atlantic
  'div.mostPopular', // Newsday
  'div#mostPopularTab', // Reuters
  'div#most-read-news-wrapper', // The Daily Mail
  'div#mostSharedTab', // Reuters
  'div#most-watched-videos-wrapper', // The Daily Mail
  'div.mTop15', // Times of India
  'div.multiplier_story', // Christian Science Monitor
  'div.nav', // KMBC (note: may be problematic)
  'div.navigation', // Renew Economy (may be problematic)
  'div#newsletterList', // E-Week
  'div#newsletter_signup_article', // People Magazine
  'div.newsletterSignupBox', // NBC
  'div.newsreel', // The Wall Street Journal
  'div.next_on_news', // BuzzFeed
  'div#next_post', // Ace Showbiz
  'div.nhlinkbox', // PBS
  'div#nlHeader', // E-Week
  'div.node-footer', // Drupal
  'div.node-metainfo', // The Boston Herald
  'div.NotifyUserBox', // Bangkok Post
  'div.npRelated', // National Post
  'div.NS_projects__project_share', // Kickstarter
  'div.oembed-asset', // USA Today
  'div.Other-stories ', // Bangkok Post
  'div.overlayPostPlay', // The Sydney Morning Herald
  'div.page_label', // Hewlett Packard News
  'div#page-nav', // Uptown Magazine
  'div.page-navigation', // Misc.
  'div.page-tools', // Channel News Asia
  'div.pagination', // Investors.com
  'div.paging_options', // Alternet
  'div.pane-explore-issues-topics', // MSNBC
  'div.par-y_rail', // Vanity Fair
  'div.pb-f-page-comments', // Washington Post
  'div.pfont', // Newsday
  'div.pin-it-btn-wrapper', // US Prison Culture
  'div.pl-most-popular', // entrepeneur.com
  'div.pnnavwrap', // NPR (previous/next article links wrapper)
  'div#popular-by-section', // Houston News
  'div#popup', // Times of India
  'div.post-actions', // WorldNetDaily
  'div.postcats', // The Wall Street Journal (blog)
  'div.postcommentpopupbox', // Times of India
  'div.post-comments', // The Sun Times
  'div.post-links', // Pro Football Talk
  'div.postmeta', // Windows Central
  'div.post-meta-category', // Comic Book Resources
  'div.post-meta-share', // Comic Book Resources
  'div.post-meta-tags', // Comic Book Resources
  'div.post-meta-taxonomy-terms', // The Sun Times
  'div.postnav', // Freakonomics
  'div.post-share-buttons', // Blogspot
  'div.post-social-iteration-wrapper', // Streetwise
  'div#post_socials', // Archeology.org
  'div.posts-stories', // Ha'Aretz
  'div.post-tags', // Teleread
  'div.post-tools-wrapper', // Gawker
  'div.post-wrap-side-share', // PBS
  'div#powered_by_livefyre_new', // Entertainment Tonight
  'div.premium-box', // Foreign Affairs
  'div#premium-box-locked', // Foreign Affairs
  'div[previewtitle="Related NPR Stories"]', // NPR
  'div#prevnext', // hostilefork
  'div#prev_post', // Ace Showbiz
  'div.primaryContent3', // Reuters (NOTE: I dislike this one)
  'div.printad', // North Jersey
  'div#print-button', // Teleread
  'div.printHide', // Telegraph UK
  'div.printstory', // North Jersey
  'div#prologue', // hostilefork
  'div#promo-expanding-region', // The Atlantic
  'div.promo-inner', // Chron.com
  'div.promo-top', // Chron.com
  'div.pull-left-tablet', // NY1 (only uses "article" for related)
  'div#pw-comments-container', // Star Advertiser
  // 'div.pull-right', // CANNOT USE (oklahoman vs nccgroup blog)
  'div.raltedTopics', // India Times
  'div#reader-comments', // The Daily Mail
  'div.read_more', // Times of India
  'div.recirculation', // New Yorker
  'div.recommended-articles-wrap', // Vice.com
  'div.recommended-links', // The Appendix
  'div.region-content-embed', // The Hill
  'div.region-content-inside', // The Hill
  'div#registration-notice', // Atlantic City Press
  'div#registrationNewVerification', // Joplin Globe
  'div#relartstory', // Times of India
  'div#related', // The Boston Globe (note: wary of using this)
  'div.related', // CNBC (note: wary of using this one)
  'div.related_articles', // Ahram
  'div.related-carousel', // The Daily Mail
  'div.related-block', // auburnpub.com
  'div.related-block2', // St. Louis Today
  'div.related-column', // The Hindu
  'div.related_content', // Bizjournal
  'div.related-items', // BBC
  'div#related_items', // Business Week
  'div.related_items', // NY Books
  'div#relatedlinks', // ABC News
  'div.related-links', // Boston.com
  'div.related-links-container', // Business Insider
  'div.related-media', // Fox News
  'div.relatedModule', // Newsday
  'div.relatedNews', // Tampa Bay
  'div.related-posts', // Buzzcarl
  'div.related-posts-inner', // threatpost.com
  'div.relatedRail', // Reuters
  'div.relateds', // CS Monitor
  'div#related-services', // BBC
  'div.relatedStories', // Salt Lake Tribute
  'div#related-stories', // Daily News
  'div#related-tags', // St. Louis Today
  'div.related-tags', // CBS
  'div#relatedTopics', // Reuters
  'div.relatedTopicButtons', // Reuters
  'div.related-vertical', // The Wrap
  'div#related-videos-container', // E-Online
  'div.relatedVidTitle', // E-Online
  'div.rel-block-news', // The Hindu
  'div.rel-block-sec', // The Hindu
  'div.relposts', // TechCrunch
  'div.resizer', // KMBC
  'div#respond', // Stanford Law
  'div#returnTraditional', // Joplin Globe
  'div#returnSocial', // Joplin Globe
  'div#reveal-comments', // Aeon Magazine
  'div#right-column', // The Hindu
  'div.right_rail_cnt', // Hewlett Packard News
  'div#rn-section', // Getty
  'div[role="article"] div.DM', // Google Plus comments
  'div[role="article"] div.Qg', // Google Plus comment count
  'div[role="article"] div.QM', // Google Plus entry tags
  'div[role="article"] div.yx', // Google Plus footer
  'div[role="complementary"]', // USA Today
  'div.rtCol', // Time Magazine
  'div#rt_contact', // CNBC
  'div#rt_featured_franchise', // CNBC
  'div#rt_primary_1', // CNBC
  'div[id^="rt_promo"]', // CNBC
  'div#rt_related_0', // CNBC
  'div#savedata1', // Times of India
  'div.save-tooltip', // auburnpub
  'div#sb_2010_story_tools', // Star Advertiser
  'div.sc_shareTools', // ABC News
  'div.sd-social', // Re-code
  'div.second-tier-social-tools', // Time Magazine
  'div#section-comments',  // The Washington Post
  'div#section-kmt', // The Guardian
  'div.section-puffs', // Telegraph UK
  'div#share', // Teleread
  'div.share > div.right', // auburnpub.com
  'div.shareArticles', // The Daily Mail
  'div.share-bar', // Gulf News
  'div.sharebar', // NY Post
  'div#sharebarx_new', // Times of India
  'div#share-block-bottom', // Dispatch.com
  'div.share-body-bottom', // BBC
  'div.share-btn', // Christian Times
  'div#share-bottom', // Teleread
  'div.share-buttons', // Quantstart
  'div#shareComments', // Teleread (also, gigya)
  'div#shareComments-bottom', // Teleread
  'div.share-container', // Business Insider
  'div.share-count-container', // CNBC
  'div.sharedaddy', // Fortune
  'div.share-help', // BBC
  'div.share_inline_header', // The Economist
  'div.share_inline_footer', // The Economist
  'div.share-items', // Vanity Fair
  'div.share-link-inline', // Sparkfun
  'div.shareLinks', // Reuters
  'div.sharetools-inline-article-ad', // NYTimes
  'div.shareToolsNextItem', // KMBC
  'div.sharingBox', // India Times
  'div.sharrre-container', // Concurring Opinions
  'div.shortcode-post', // ABC7 News
  'div.show-related-videos', // CBS News
  'div.show-share', // The Atlantic
  'div.sidebar', // Belfast Telegraph
  'div#sidebar', // The Appendix
  'div.sideBar', // Bangkok Post
  'div.sidebar1', // local12
  'div.sidebar2', // local12
  'div#sidebar-3', // SysCon Media
  'div#sidebar-4', // SysCon Media
  'div.sidebar-content', // Concurring opinions
  'div.sidebar-feed', // WRAL
  'div.side-news-area', // Channel News Asia
  'div#signIn', // Joplin
  'div.simpleShare', // Newsday
  'div#simple_socialmedia', // Freakonomics
  'div.single-author', // Recode
  'div.single-related', // USA Today
  'div.sitewide-footer', // NBCNews
  'div.sitewide-header-content', // NBCNews
  'div.slideshow-controls', // Vanity Fair
  'div.small-rotator', // CTV News
  'div.social', // BBC
  'div.social-action', // Pakistan Daily
  'div.social-actions', // BuzzFeed
  'div.socialbar', // Autonews
  'div.socialBar', // Chron.com
  'div.social-bar', // The Miami Herald
  'div.social-bookmarking-module', // Wired.com
  'div.social-buttons', // The Verge
  'div.social-column', // TechSpot
  'div.social-count', // Fox News
  'div.social-dd', // The Wall Street Journal
  'div.sociable', // Mint Press
  'div.social_icons', // Forbes
  'div#social-links', // Reuters
  'div.social-links ', // SF Gate
  'div.social-links-bottom', // MSNBC
  'div.social-links-top', // MSNBC
  'div.social-news-area', // Channel News Asia
  'div.socialNetworks', // NBC
  'div#socialRegistration', // Joplin Globe
  'div#social-share', // Priceonomics
  'div.social-share', // Bloomberg
  'div.social-share-top', // Priceonomics
  'div.social-share-bottom', // The Hill
  'div.social-toolbar', // News OK
  'div.social-toolbar-affix', // News OK
  'div#socialTools', // Salt Lake Tribute
  'div.social-tools-wrapper-bottom ', // Washington Post
  'div.spantab', // Times of India
  'div.SPOSTARBUST-Related-Posts', // RObservatory
  'div.sps-twitter_module', // BBC
  'div.srch_box', // Times of India
  'div.ssba', // Funker (social share button actions?)
  'div#ssba', // Clizbeats
  'div.ssb-share', // 365Solutions
  'div.stack-talent', // NBC News (author bio)
  'div.stack-video-nojs-overlay', // NBC News
  'div.staff_info', // Bizjournals
  'div.statements-list-container', // Topix
  'div#sticky-nav', // Christian Science Monitor
  'div.sticky-tools', // The Boston Globe
  'div#story_add_ugc', // Fort Worth Star Telegram
  'div.story-block--twitter', // 9News
  'div.story-comment', // Latin Post
  'div.story_comments', // Alternet
  'div#storyContinuesBelow', // Salt Lake Tribune
  'div#storyControls', // Politico
  'div#story-embed-column', // Christian Science Monitor
  'div.story-extras', // The Australian
  'div#story-footer', // The Miami Herald
  'div.story-footer', // The Australian
  'div.story-header-tools', // The Australian
  'div.story_list', // Christian Science Monitor
  'div#storyMoreOnFucntion', // Telegraph UK
  'div.storynav', // TechCrunch
  'div.story_pagination', // ABC News
  'div#story_right_column_ad', // dailyjournal.net
  'div.StoryShareBottom', // CTV News
  'div#story-share-buttons', // USA Today
  'div.story-share-buttons', // USA Today
  'div#story-share-buttons-old', // USA Today
  'div#story-shoulder', // AV Web
  'div.story-tags', // Fox Sports
  'div.story-taxonomy', // ABC Chicago
  'div.story-toolbar', // Politico
  'div.storytools', // TechCrunch
  'div.story-tools', // Latin Post
  'div.story_tools_bottom', // Alternet
  'div.story-tools-wrap', // Charlotte Observer
  'div.submit-button', // Knight News Challenge
  'div.subnav-tools-wrap', // NPR
  'div.subscribe', // Times of India
  'div#subscription-notice', // Atlantic City Press
  'div.supplementalPostContent', // Medium.com
  'div#tabs-732a40a7-tabPane-2', // The Miami Herald (unclear)
  'div.tag-list', // NY Post (iffy on this one)
  'div.talklinks', // LiveJournal
  'div.taxonomy', // ABC Chicago
  'div.t_callout', // ABC News
  'div#teaserMarketingCta', // The Times
  'div.text-m-in-news', // The Australian
  'div.textSize', // CBS
  'div#teaser-overlay', // The Times
  'div.thirdPartyRecommendedContent', // KMBC
  'div#thumb-scroller', // E-Week
  'div.three-up-list', // The Huffington Post
  'div#tmg-related-links', // Telegraph Co
  'div#tncms-region-jh-article-bottom-content', // Idaho Press
  'div.tncms-restricted-notice', // Atlantic City Press
  'div.toolbox', // ABC News
  'div.tools', // ABC News (risky, might be a content-tag)
  'div.tools1', // The Wall Street Journal (blog)
  'div.topic-category', // Bangkok Post
  'div.top-index-stories', // BBC
  'div.topkicker', // entrepreneur.com
  'div.toplinks', // VOA News
  'div.top-stories-range-module', // BBC
  'div.top-stories05', // Telegraph UK
  'div#traditionalRegistration', // Joplin Globe
  'div#traditionalAuthenticateMerge', // Joplin Globe
  'div.trb_embed_related', // LA Times
  'div.trb_panelmod_body', //  LA Times
  'div.twipsy', // St. Louis Today
  'div.upshot-social', // The New York Times
  'div.util-bar-flyout', // USA Today
  'div.utilities', // The Times
  'div#utility', // WRAL
  'div.utility-bar', // USA Today
  'div.utility-panels', // WRAL
  'div.utils', // kotatv
  'div.utilsFloat', // KMBC
  'div.video_about_ad', // Christian Science Monitor
  'div.video_disqus', // Bloomberg
  'div#video-share', // ABC News
  'div.view-comments', // auburnpub.com
  'div#vuukle_env', // The Hindu
  'div.wideheadlinelist2', // Chron.com
  'div.windows-phone-links', // Windows Central
  'div#WNCol4', // Fox (subsidary myfoxny.com)
  'div#WNStoryRelatedBox', // Fox (subsidiary myfoxal.com)
  'div.wp_rp_wrap', // BuzzCarl (wordpress related post)
  'div.xwv-related-videos-container', // The Daily Mail
  'div.x-comment-menu', // Topix
  'div.x-comments-num', // Topix
  'div.x-comment-post-wrap', // Topix
  'div.yarpp-related', // Spoon-Tamago
  'div#you-might-like', // The New Yorker
  'div#zergnet', // Comic Book Resources
  'dl.blox-social-tools-horizontal', // Joplin
  'dl#comments', // CJR
  'dl.keywords', // Vanity Fair
  'dl.related-mod', // Fox News
  'dl.tags', // NY Daily News
  'embed',
  'fieldset',
  'figure.ib-figure-ad', // KMBC
  'figure.kudo', // svbtle.com blogs
  'footer',
  'form#comment_form', // Doctors Lounge
  'form.comments-form', // CJR
  'frameset',
  'head',
  'header',
  'h1#external-links', // The Sprawl (preceds unnamed <ul>)
  'h2#comments', // WordPress lemire-theme
  'h2.hide-for-print', // NobelPrize.org
  'h2#page_header', // CNBC
  'h3#comments-header', // Knight News Challenge
  'h3.more-keywords', // Joplin
  'h3.related_title', // Teleread
  'h3#scrollingArticlesHeader', // The Oklahoman
  'h4.taboolaHeaderRight', // KMBC
  'hr',
  'iframe',
  'img#ajax_loading_img', // E-Week
  'input',
  'isindex',
  'li.comments', // Smashing Magazine
  'li#mostPopularShared_0', // Reuters
  'li#mostPopularShared_1', // Reuters
  'li#pagingControlsPS', // neagle
  'li#sharetoolscontainer', // neagle
  'li.tags', // Smashing Magazine
  'link',
  'math',
  'menu',
  'menuitem',
  'meta',
  'nav',
  'object', 
  'output',
  'option',
  'optgroup',
  'ol[data-vr-zone="Around The Web"]', // The Oklahoman
  'ol#comment-list', // Pro Football Talk
  'ol#commentlist', // WordPress lemire-theme
  'p.article-more', // The Boston Globe
  'p.authorFollow', // The Sydney Morning Herald
  'p.byline', // Newsday
  'p.category', // SysCon Media
  'p.comments', // Telegraph Co Uk
  'p.copy-rights-text', // Jerusalem Post
  'p.essay-tags', // Aeon Magazine
  'p.meta', // http://michael.otacoo.com/
  'p.moreVideosTitle', // E-Online
  'p.must-log-in', // The Jewish Press
  'p.pagination', // Stamford Advocate
  'p.p_top_10', // Star Telegram
  'p.post-tags', // USA Today
  'p.section-tag', // NY Post
  'p.sm_icon_subscribe', // The Week
  'p.story-ad-txt', // Boston.com
  'p.storytag', // chinatopix.com
  'p.story-tags', // Latin Post
  'p.topics', // ABC News
  'p.trial-promo', // Newsweek
  'p.subscribe_miles', // Charlotte Observer
  'p#whoisviewing', // Eev blog
  'param',
  'g\\:plusone',
  'progress',
  'script',
  'section.also-on', // Huffington Post
  'section.around-bbc-module', // BBC
  'section.article-author', // Ars Technica
  'section.article-contributors', // The New Yorker
  'section.bottom_shares', // BuzzFeed
  'section.breaking_news_bar', // Bloomberg
  'section#comment-module', // Dispatch.com
  'section#comments', // TechSpot
  'section.comments', // ABC Chicago
  'section#comments-area', // The Economist
  'section#follow-us', // BBC
  'section.headband', // Bloomberg
  'section.headline-list', // The Miami Herald
  'section.headlines-list', // ABC Chicago
  'section#injected-newsletter', // GigaOM
  'section.morestories', // Entertainment Tonight
  'section#more_stories', // NBC Nebraska
  'section#more-stories-widget', // The Miami Herald
  'section#newsletter-signup', // New Yorker
  'section.pagination_controls', // Vanity Fair
  'section#promotions', // The New Yorker
  'section.related_links', // Bloomberg
  'section#related-links', // BuzzFeed
  'section.related-products', // TechSpot
  'section#relatedstories', // NPR
  'section#responses', // BuzzFeed
  'section.section--last', // Medium
  'section.section-tertiary', // Sports Illustrated
  'section.share-section', // Sports Illustrated
  'section.signup-widget', // The Miami Herald
  'section.story-tools-mod', // Boston.com
  'section.suggested-links', // The Examiner
  'section.tagblock', // Entertainment Tonight
  'section.three-up', // The Huffington Post
  'section.topnews', // Christian Times
  'section.top-video', // ABC 7 News
  'section.youmaylike', // Entertainment Tonight
  'select',
  'spacer',
  'span.comment-count-generated', // Teleread
  'span.fb-recommend-btn', // The Daily Voice
  'span[itemprop="inLanguage"]', // Investors.com
  'span.sharetools-label', // NY Time
  'span.moreon-tt', // Teleread
  'span.printfriendly-node', // Uncover California
  'span.story-date', // BBC Co Uk
  'span.text_resizer', // Fort Worth Star Telegram
  'style', 
  'table.hst-articleprinter', // Stamford Advocate
  'table#commentTable', // Times of India
  'table.complexListingBox', // Mercury News
  'table.storyauthor', // SysCon Media
  'table.TopNavigation', // LWN
  'textarea',
  'title',
  'ul#additionalShare', // NBC
  'ul.articleList', // The Wall Street Journal
  'ul.article-options', // TVNZ
  'ul.article-related-wrap', // Jerusalem Post
  'ul.article-share', // DNA India
  'ul.article-share-bar', // Herald Scotland
  'ul#article-share-links', // The Boston Herald
  'ul.article-social', // NBC News
  'ul.article-tags', // 9News
  'ul.article_tools', // The Wall Street Journal
  'ul#associated', // TV New Zealand
  'ul#blox-body-nav', // Houston News
  'ul.blox-recent-list', // Atlantic City Press
  'ul.breadcrumb', // The Miami Herald
  'ul.breadcrumbs', // Giga OM
  'ul#bread-crumbs', // Dispatch.com
  'ul.breaking-news-stories', // ABC 7 News
  'ul.bull-list', // Joplin
  'ul.cats', // Windows Central
  'ul.comment-list', // Sparkfun
  'ul#content_footer_menu', // Japan Times
  'ul.display-posts-listing', // Recode
  'ul.entry-extra', // Wired Magazine
  'ul.entry-header', // Wired Magazine
  'ul.entry_sharing', // Bloomberg
  'ul#flairBar', // Scientific American
  'ul.flippy', // MSNBC
  'ul.generic_tabs', // Bloomberg
  'ul.header-lnks', // Knight News Challenge
  'ul.hl-list', // Chron.com
  'ul.links--inline', // Drupal
  'ul.links-list', // BBC
  'ul.m-block__meta__links', // Tomahawk Nation
  'ul.menu', // The New York Times
  'ul.mod-page-actions', // ESPN
  'ul.navbar-nav', // Noctua Software Blog
  'ul.navigation', // USA Today
  'ul.nav-tabs', // The Miami Herald
  'ul.newslist', // Autonews
  'ul#page-actions-bottom', // ESPN
  'ul.pageBoxes', // Investors.com
  'ul.pagenav', // The Guardian
  'ul.pagination', // Politico
  'ul.pagination-story', // Time
  'ul.project-nav', // Kickstarter
  'ul.related-links', // The Boston Globe
  'ul.related_links', // Ottawa Citizen
  'ul.related-posts', // Concurring Opinions
  'ul.resize-nav', // Channel News Asia
  'ul.rssi-icons', // Pacific Standard Magazine
  'ul.services', // The Appendix
  'ul.share', // WBUR
  'ul.sharebar', // CNet
  'ul.share-buttons', // Ars Technica
  'ul.share_top', // CJR
  'ul.sharing-tool', // The Daily Voice
  'ul.side-news-list', // Channel News Asia
  'ul.singleshare', // Freakonomics
  'ul.sns-buttons', // The Daily Voice
  'ul#social', // rickeyre blog
  'ul.social', // The Sydney Morning Herald
  'ul.social-bookmarking-module', // Wired Magazine
  'ul.social-buttons', // Spoon-Tamago
  'ul.socialByline', // The Wall Street Journal (blog)
  'ul.social-icons', // Citylab
  'ul.social-list', // NBC News
  'ul.socials', // independent.ie
  'ul.social-share-list', // TechCrunch
  'ul.social-tools', // The Washington Post
  'ul#story-font-size', // Idaho Press
  'ul#story-social', // AV Web
  'ul#story-tools', // AV Web
  'ul.story-tools-sprite', // Houston News
  'ul.tags', // BBC
  'ul.tags-listing', // Colorado Independent
  'ul.text-scale', // GigaOM
  'ul.thumbs', // NY Daily News
  'ul#toolbar-sharing', // UT San Diego
  'ul.tools', // The Syndey Morning Herald
  'ul#topics', // Yahoo News
  'ul.toplinks', // VOA News
  'ul.top-menu', // Investors.com
  'ul.utility-list', // WRAL
  'video',
  'xmp'
];

} // END LEXICAL SCOPE
