// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file



// TODO: express everything as probability. Use a scale of 0 to 100
// to represent each element's likelihood of being useful content, where
// 100 is most likely. Every blcok gets its own probability score. Then
// iteratively backfrom from a threshold of something like 50%. Or instead
// of blocks weight the elements and use the best element approach again,
// where probability means the likelihood of any given element being the
// best element, not whether it is content or boilerplate.
// TODO: maybe use a single bias function and just extract features prior to that
// TODO: use a single function called applyCalamine, deprecate the IIFE

function applyCalamine(document, options) {
  'use strict';

  const forEach = Array.prototype.forEach;
  const reduce = Array.prototype.reduce;
  const filter = Array.prototype.filter;

  function remove(element) {
    element.remove();
  }

  // NOTE: walks upward
  function getAncestors(element) {
    const parents = [];
    var parent = element;
    while(parent = parent.parentElement) {
      parents.push(parent);
    }
    return parents;
  }

  function getImageCaption(image) {
    const parents = getAncestors(image);  
    const figure = parents.find(function(element){
      return element.localName === 'figure';
    });
    if(figure) {
      return figure.querySelector('figcaption');
    }
  }

  function identity(value) {
    return value;
  }

  // TODO: split on case-transition (lower2upper,upper2lower)
  // TODO: Array.from?
  function tokenize(value) {
    const tokens = value.toLowerCase().split(/[\s\-_0-9]+/g).filter(identity);
    const set = new Set(tokens);
    const result = [];
    set.forEach(function(v) {
      result.push(v);
    });
    return result;
  }

  const SCORABLE_ATTRIBUTES = ['id', 'name', 'class', 'itemprop', 
    'itemtype', 'role'];

  function getItemTypePath(element) {
    // http://schema.org/Article
    // http://schema.org/NewsArticle
    // http://schema.org/BlogPosting
    // http://schema.org/Blog
    // http://schema.org/WebPage
    // http://schema.org/TechArticle
    // http://schema.org/ScholarlyArticle
    var value = element.getAttribute('itemtype');
    if(!value) return;
    value = value.trim();
    if(!value) return;
    const lastSlashIndex = value.lastIndexOf('/');
    if(lastSlashIndex == -1) return;
    const path = value.substring(lastSlashIndex + 1);
    return path;
  }

  function getAttributeBias(element) {
    const values = SCORABLE_ATTRIBUTES.map(function(name) {
      return name == 'itemtype' ? getItemTypePath(element) :
        element.getAttribute(name);
    }).filter(identity);
    const tokens = tokenize(values.join(' '));
    return tokens.reduce(function(sum, value) {
      return sum + ATTRIBUTE_BIAS.get(value) || 0;
    }, 0);
  }

  function applySingleClassBias(className, bias) {
    const elements = document.getElementsByClassName(className);
    if(elements.length != 1) return;
    const e = elements[0];
    if(options.ANNOTATE) {
      e.dataset.attributeBias = parseInt(e.dataset.attributeBias || '0') + bias;
    }
    scores.set(e, scores.get(e) + bias);
  }

  // NOTE: not optimized for live documents
  function unwrap(element) {
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

  if(!document) {
    console.warn('Invalid document');
    return;
  }

  options = options || {};

  // Remove comments
  for(let iterator = document.createNodeIterator(
    document, NodeFilter.SHOW_COMMENT), node = iterator.nextNode(); node;
    node = iterator.nextNode()) {
    node.remove();
  }

  // Remove blacklisted elements
  const BLACKLISTED_ELEMENTS = [
    'head', 'applet', 'base', 'basefont', 'bgsound', 'button', 'command',
    'datalist', 'dialog', 'embed', 'fieldset', 'frameset',
    'iframe', 'input', 'isindex', 'math', 'link', 'menu',
    'menuitem', 'meta', 'object','optgroup',  'output', 'param', 'progress',
    'script', 'spacer', 'style', 'textarea', 'title', 'xmp',
    'select', 'option',
    'g\\:plusone', 'fb\\:comments'
  ].join(',');
  forEach.call(document.querySelectorAll(BLACKLISTED_ELEMENTS), remove);

  // Remove elements matching blacklisted selectors
  BLACKLIST_SELECTORS.forEach(function(selector) {
    forEach.call(document.querySelectorAll(selector), remove);
  });

  // Remove sourceless images and tracer images
  filter.call(document.getElementsByTagName('img'), function(image) {
    const source = image.getAttribute('src');
    const width = image.getAttribute('width');
    const height = image.getAttribute('height');
    return !source || !source.trim() || 
      width === '0' || width === '0px' || width === '1' ||
      height === '1px' || height === '1' || image.width === 0 ||
      image.width === 1 || image.height === 0 || image.height === 1
  }).forEach(remove);

  // Unwrap noscript and noframes elements
  forEach.call(document.querySelectorAll('noscript, noframes'), unwrap);

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

  // Normalize whitespace
  for(let iterator = document.createNodeIterator(document, 
    NodeFilter.SHOW_TEXT), node = iterator.nextNode(); node;
    node = iterator.nextNode()) {
    node.nodeValue = node.nodeValue.replace(/\s/g, ' ');
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

  // Remove empty text nodes
  for(let iterator = document.createNodeIterator(document, 
    NodeFilter.SHOW_TEXT), node = iterator.nextNode(); node; 
    node = iterator.nextNode()) {
    if(!node.nodeValue) {
      node.remove();
    }
  }

  const elements = document.getElementsByTagName('*');

  // Init element scores
  const scores = new Map();
  scores.set(document.documentElement, 0);
  scores.set(document.body, 0);
  forEach.call(elements, function(element) { 
    scores.set(element, 0);
  });

  // Collect text node lengths
  // TODO: use for loop
  const textLengths = new Map();
  const textNodeIterator = document.createNodeIterator(document, 
    NodeFilter.SHOW_TEXT);
  let textNode = textNodeIterator.nextNode();
  while(textNode) {
    let length = textNode.nodeValue.length;
    if(length) {
      textNode = textNode.parentNode;
      while(textNode) {
        textLengths.set(textNode, (textLengths.get(textNode) || 0) + length);
        textNode = textNode.parentNode;
      }
    }

    textNode = textNodeIterator.nextNode();
  }

  // Collect anchor text length
  const anchors = document.querySelectorAll('a[href]');
  const anchorLengths = reduce.call(anchors, function (map, anchor) {
    const count = textLengths.get(anchor);
    return count ? [anchor].concat(getAncestors(anchor)).reduce(function(map,
      element) {
      return map.set(element, (map.get(element) || 0) + count);
    }, map) : map;
  }, new Map());

  // Apply text bias
  // Adapted from "Boilerplate Detection using Shallow Text Features"
  // http://www.l3s.de/~kohlschuetter/boilerplate
  // TODO: when the main container has several links, this generates a very
  // negative bias. Maybe propagate link text to only block level containers,
  // or proportionally decrease the negative bias based on depth
  forEach.call(elements, function(element) {
    const textLength = textLengths.get(element);
    if(!textLength) return;
    const anchorTextLength = anchorLengths.get(element) || 0;
    let bias = (0.25 * textLength) - (0.7 * anchorTextLength);
    bias = Math.min(4000, bias);// tentative cap
    scores.set(element, scores.get(element) + bias);
    if(options.ANNOTATE) {
      element.dataset.textChars = textLength;
      if(anchorTextLength) {
        element.dataset.anchorChars = anchorTextLength;
      }
      element.dataset.textBias = bias.toFixed(2);
    }
  });

  // Apply an empirical intrinsic bias (based on the element type)
  // TODO: there are only maybe 5-6 likely elements and everything else
  // is very unlikely. <div> is the most likely.
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

  forEach.call(elements, function(element) {
    const bias = INTRINSIC_BIAS.get(element.localName);
    if(bias) {
      if(options.ANNOTATE) {
        element.dataset.intrinsicBias = bias;
      }
      scores.set(element, scores.get(element) + bias);
    }
  });

  // Pathological case for applying intrinsic bias to single article
  const articles = document.getElementsByTagName('article');
  if(articles.length === 1) {
    if(options.ANNOTATE) {
      articles[0].dataset.intrinsicBias = 1000;
    }
    scores.set(articles[0], scores.get(articles[0]) + 1000);
  }

  // Penalize list descendants
  const listDescendants = document.querySelectorAll(
    'li *, ol *, ul *, dd *, dl *, dt *');
  forEach.call(listDescendants, function(element) {
    if(options.ANNOTATE) {
      element.dataset.inListPenaltyBias = -100;
    }
    scores.set(element, scores.get(element) - 100);
  });

  // Penalize descendants of navigational elements
  const navDescendants = document.querySelectorAll(
    'aside *, header *, footer *, nav *');
  forEach.call(navDescendants, function(element) {
    if(options.ANNOTATE) {
      element.dataset.inNavPenaltyBias = -50;
    }
    scores.set(element, scores.get(element) - 50);
  });

  // Bias the parents of certain elements
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

  forEach.call(elements, function(element) {
    const bias = DESCENDANT_BIAS.get(element.localName);
    if(!bias) return;
    const parent = element.parentElement;
    if(options.ANNOTATE) {
      let prevParentBias = parent.dataset.descendantBias || '0';
      parent.dataset.descendantBias = parseInt(prevParentBias) + bias;
    }
    scores.set(parent, scores.get(parent) + bias);
  });

  // Bias image containers
  forEach.call(document.getElementsByTagName('img'), function(image) {
    const parent = image.parentElement;
    const carouselBias = reduce.call(parent.childNodes, function (bias, node) {
      return 'img' === node.localName && node !== image ? bias - 50 : bias;
    }, 0);
    // TODO: this should probably also check data-alt and data-title as many
    // sites use this alternate syntax
    const descBias = image.getAttribute('alt') ||  image.getAttribute('title') ||
      getImageCaption(image) ? 30 : 0;
    const area = image.width ? image.width * image.height : 0;
    const areaBias = 0.0015 * Math.min(100000, area);
    const imageBias = carouselBias + descBias + areaBias;
    if(!imageBias) return;
    if(options.ANNOTATE) parent.dataset.imageBias = imageBias;
    scores.set(parent, scores.get(parent) + imageBias);
  });

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

  // Bias certain elements based on their attributes
  // TODO: itemscope
  // TODO: itemtype 'article' id/class issue
  const elementsWithAttributes = document.querySelectorAll('a, aside, div,' +
    ' dl, figure, h1, h2, h3, h4, ol, p, section, span, ul');
  forEach.call(elementsWithAttributes, function(element) {
    const bias = getAttributeBias(element);
    if(options.ANNOTATE) element.dataset.attributeBias = bias;
    scores.set(element, scores.get(element) + bias);
  });

  // Pathological cases
  // TODO: article_body (E-Week) ?
  // TODO: itemprop="articleBody" ?
  // TODO: [role="article"] ? (Google Plus)
  // TODO: [itemtype="http://schema.org/Article"] ??
  applySingleClassBias('article', 1000);
  applySingleClassBias('articleText', 1000);
  applySingleClassBias('articleBody', 1000);

  // Annotate element scores
  if(options.ANNOTATE) {
    forEach.call(doc.getElementsByTagName('*'), function(element) {
      const score = scores.get(element);
      if(!score) return;
      element.dataset.score = score.toFixed(2);
    });    
  }

  // Find the best element
  let bestElement = document.body;
  let bestElementScore = scores.get(bestElement);
  forEach.call(elements, function(element) {
    let score = scores.get(element);
    if(score > bestElementScore) {
      bestElement = element;
      bestElementScore = score;
    }
  });

  // Remove all elements that do not intersect with the best element
  forEach.call(elements, function(element) {
    if(element === document.documentElement || element === document.body ||
      element === bestElement) {
      return;
    }
    // TODO: use Node.compareDocumentPosition for better performance
    if(!bestElement.contains(element) && !element.contains(bestElement)) {
      element.remove();
    }
  });

  // Remove javascript anchors
  // TODO: can this be performed earlier?
  filter.call(document.querySelectorAll('a[href]'), function(anchor) {
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

  for(let element = document.querySelector(UNWRAPPABLE_ELEMENTS),
    iterations = 0; element && (iterations < 3000); 
    element = document.querySelector(UNWRAPPABLE_ELEMENTS), iterations++) {
    unwrap(element);
  }

  // Unwrap nominal anchors
  filter.call(document.getElementsByTagName('a'), function(anchor) {
    const href = anchor.getAttribute('href');
    return !href || !href.trim();
  }).forEach(unwrap);

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

  removeAttributes(document);
  forEach.call(document.getElementsByTagName('*'), removeAttributes);
  removeLeaves(document);
  transformSingleItemLists(document);
  trimElement(document);
}

function removeLeaves(document) {
  'use strict';

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
  const elements = document.getElementsByTagName('*');
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
    if(!grandParent || grandParent == document.body || 
      grandParent == document.documentElement) {
      continue;
    }

    stack.push(grandParent);
  }
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

