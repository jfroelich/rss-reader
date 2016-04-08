// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Lib for filtering the contents of an HTML Document object
// Requires: /src/dom.js
// Requires: /src/sanity-attribute.js
// Requires: /src/sanity-leaf.js
// Requires: /src/sanity-table.js
// Requires: /src/sanity-unwrap.js
// Requires: /src/sanity-visibility.js

// TODO: research why some articles appear without content. I know pdfs
// work this way, but look into the issue with other ones.

// TODO: explicit handling of noembed/audio/video/embed
// TODO: explicit handling of noscript

// TODO: maybe I should have some other function
// that deals with malformed html and removes all nodes that do not conform
// to <html><head>*</head><body>*</body></html> and then none of the sanity
// functions need to be concerned.

// TODO: some things i want to maybe deal with at this url
// view-source:http://stevehanov.ca/blog/index.php?id=132

// It is using sprites. So transp is ignored. osrc is also ignored, i think it
// was macromedia dreamweaver rollover code that also just serves as a reminder
// of the desired original image source if rollover is disabled, and then
// the style points to the image embedded within a sprite.
// <img src="transparent.gif" osrc="kwijibo.png" style="background:
// url(sprite.jpg); background-position: 0px -5422px;width:270px;height:87px">
// I would have to modify a lot of things to support this. I would have to
// make sure urls appropriate resolved, that image not incorrectly removed,
// and i would have to partially retain style value.

// Another issue with the page is flow formatting, maybe I want to correct
// this or maybe I want to allow it, not sure.
// * H1s within anchors?

// TODO: due to handling of <noscript> this is causing articles from
// fortune.com to appear empty. Remove noscript from blacklisted elements.
// Then write a function that handles noscript specially.


function sanity_sanitize_document(document) {
  'use strict';

  sanity_filter_comments(document);
  sanity_replace_frames(document);

  sanity_filter_noscripts(document);

  // sanity_filter_out_of_body_nodes(document);
  sanity_filter_blacklisted_elements(document);
  sanity_filter_hidden_elements(document);

  // This feature is disabled because it does not work very well right now
  // and is not too critical.
  //sanity_replace_break_rules(document);

  sanity_filter_anchors(document);
  sanity_filter_images(document);
  sanity_filter_unwrappables(document);
  sanity_filter_texts(document);
  sanity_filter_lists(document);
  sanity_filter_tables(document);
  sanity_filter_leaves(document);
  sanity_filter_consecutive_rules(document);
  sanity_filter_consecutive_break_rules(document);
  sanity_trim_document(document);
  sanity_filter_attributes(document);
}

// NOTE: we cannot remove noscript elements because some sites embed the
// article within a noscript tag. So instead we treat noscripts as unwrappable
// Because noscripts are a special case for now I am not simply adding noscript
// to sanity-unwrap
// We still have to unwrap. If noscript remains, the content remains within the
// document, but it isn't visible/rendered because we obviously support scripts
// and so the browser hides it. So now we have to remove it.
function sanity_filter_noscripts(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const noscripts = bodyElement.querySelectorAll('noscript');
  const numNoscripts = noscripts.length;

  for(let i = 0; i < numNoscripts; i++) {
    dom_unwrap(noscripts[i], null);
  }
}


// This uses a blacklist approach instead of a whitelist because of issues
// with custom html elements. If I used a whitelist approach, any element
// not in the whitelist would be removed. The problem is that custom elements
// wouldn't be in the whitelist, but they easily contain valuable content.
function sanity_filter_blacklisted_elements(document) {
  'use strict';

  const BLACKLIST = [
    'APPLET', 'AUDIO', 'BASE', 'BASEFONT', 'BGSOUND', 'BUTTON', 'COMMAND',
    'DATALIST', 'DIALOG', 'EMBED', 'FIELDSET', 'FRAME', 'FRAMESET', 'HEAD',
    'IFRAME', 'INPUT', 'ISINDEX', 'LINK', 'MATH', 'META',
    'OBJECT', 'OUTPUT', 'OPTGROUP', 'OPTION', 'PARAM', 'PATH', 'PROGRESS',
    'SCRIPT', 'SELECT', 'SPACER', 'STYLE', 'SVG', 'TEXTAREA', 'TITLE',
    'VIDEO', 'XMP'
  ];
  const BLACKLIST_SELECTOR = BLACKLIST.join(',');

  const docElement = document.documentElement;
  const elements = document.querySelectorAll(BLACKLIST_SELECTOR);
  const numElements = elements.length;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(docElement.contains(element)) {
      element.remove();
    }
  }
}

// This function is temp, just researching an issue
function sanity_filter_out_of_body_nodes(document) {
  'use strict';

  // See this page
  // http://blog.hackerrank.com/step-0-before-you-do-anything/
  // It has an error with a noscript node. The guy forgot the < to start the
  // nested script tag in it. So, part of its contents becomes a
  // text node. This text node is somehow the first text node of the body in
  // the DOM hierarchy represented to me in JS,
  // even though it is not located within the body. Because it isn't filtered
  // by the blacklist or anything, it shows up really awkwardly within the
  // output as the first piece of body text.

  const docElement = document.documentElement;
  const body = document.body;
  if(!body) {
    return;
  }

  const iterator = document.createNodeIterator(body, NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    console.debug('Text:', node);
  }
}

function sanity_filter_comments(document) {
  'use strict';

  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let comment = it.nextNode(); comment; comment = it.nextNode()) {
    comment.remove();
  }
}

// TODO: research why content sometimes appears garbled, like encoded, as if
// it is re-encoding html, when using content of noframes
// TODO: what if both body and frameset are present?
function sanity_replace_frames(document) {
  'use strict';

  // TODO: there can be multiple bodies when illformed. Maybe use
  // querySelectorAll and handle multi-body branch differently

  const frameset = document.body;
  if(!frameset || frameset.nodeName !== 'FRAMESET') {
    return;
  }

  const body = document.createElement('BODY');
  const noframes = document.querySelector('NOFRAMES');
  if(noframes) {
    body.innerHTML = noframes.innerHTML;
  } else {
    body.textContent = 'Unable to display framed document.';
  }

  frameset.remove();
  document.documentElement.appendChild(body);
}

// NOTE: anchor.protocol === 'javascript:' is slower than using a regular
// expression
function sanity_filter_anchors(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const anchors = bodyElement.querySelectorAll('A');
  const numAnchors = anchors.length;
  const JS_PATTERN = /^\s*JAVASCRIPT\s*:/i;
  const MIN_HREF_LEN = 'JAVASCRIPT'.length;

  // NOTE: i decided to not care about how hasAttribute returns true even
  // if its value is an empty string. I save a lot of processing.

  for(let i = 0, anchor, href; i < anchors; i++) {
    anchor = anchors[i];
    if(anchor.hasAttribute('href')) {
      href = anchor.getAttribute('href');
      // Neutralize javascript anchors
      if(href.length > MIN_HREF_LEN && JS_PATTERN.test(href)) {
        // NOTE: consider removing or unwrapping
        anchor.setAttribute('href', '');
      }
    } else if(!anchor.hasAttribute('name')) {
      // Without a name and href this is just a formatting
      // anchor so unwrap it.
      dom_unwrap(anchor);
    }
  }
}

function sanity_filter_lists(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  // TODO: support DT/DD ?

  const lists = bodyElement.querySelectorAll('UL, OL');
  for(let i = 0, len = lists.length, list, item; i < len; i++) {
    list = lists[i];
    if(list.childElementCount === 1) {
      item = list.firstElementChild;
      if(item.nodeName === 'LI') {
        dom_insert_children_before(item, list);
        list.remove();
      }
    }
  }
}

function sanity_filter_consecutive_rules(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const elements = bodyElement.querySelectorAll('HR');
  const numElements = elements.length;

  for(let i = 0, rule, prev; i < numElements; i++) {
    prev = elements[i].previousSibling;
    if(prev && prev.nodeName === 'HR') {
      prev.remove();
    }
  }
}

function sanity_filter_consecutive_break_rules(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const elements = bodyElement.querySelectorAll('BR');
  const numElements = elements.length;

  for(let i = 0, prev; i < numElements; i++) {
    prev = elements[i].previousSibling;
    if(prev && prev.nodeName === 'BR') {
      prev.remove();
    }
  }
}

function sanity_replace_break_rules(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  // TODO: improve, this is very buggy
  // error case: http://paulgraham.com/procrastination.html

  const elements = bodyElement.querySelectorAll('BR');
  const numElements = elements.length;

  for(let i = 0, element, parent, p; i < numElements; i++) {
    element = elements[i];
    parent = element.parentNode;
    p = document.createElement('P');
    parent.replaceChild(p, element);
  }
}

function sanity_filter_images(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const elements = bodyElement.querySelectorAll('IMG');
  const numElements = elements.length;

  for(let i = 0, image; i < numElements; i++) {
    image = elements[i];

    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      image.remove();
    } else if(image.width < 2 || image.height < 2) {
      image.remove();
    }
  }
}

function sanity_trim_document(document) {
  'use strict';

  const bodyElement = document.body;

  // Body is required. This only examines nodes contained within the body.
  if(!bodyElement) {
    return;
  }

  const firstChild = bodyElement.firstChild;
  if(firstChild) {
    sanity_remove_trimmable_nodes_by_step(firstChild, 'nextSibling');
    const lastChild = bodyElement.lastChild;
    if(lastChild && lastChild !== firstChild) {
      sanity_remove_trimmable_nodes_by_step(bodyElement.lastChild,
        'previousSibling');
    }
  }
}

function sanity_remove_trimmable_nodes_by_step(startNode, step) {
  'use strict';

  const VOIDS = {'BR': 1, 'HR': 1, 'NOBR': 1};
  const ELEMENT = Node.ELEMENT_NODE;
  const TEXT = Node.TEXT_NODE;
  let node = startNode, sibling = startNode;
  while(node && ((node.nodeType === ELEMENT && node.nodeName in VOIDS) ||
    (node.nodeType === TEXT && !node.nodeValue.trim()))) {
    sibling = node[step];
    node.remove();
    node = sibling;
  }
}

function sanity_filter_texts(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  // The whitespace of text nodes within these elements is important.
  const SENSITIVE_SELECTOR = 'CODE, PRE, RUBY, TEXTAREA, XMP';

  const iterator = document.createNodeIterator(bodyElement,
    NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(), value, length = 0; node;
    node = iterator.nextNode()) {
    value = node.nodeValue;
    length = value.length;
    if(length > 3) {
      if(length > 5) {
        // Normalize whitespace
        value = value.replace(/&nbsp;/ig, ' ');
      }
      if(!node.parentNode.closest(SENSITIVE_SELECTOR)) {
        // Condense consecutive spaces
        value = value.replace(/\s{2,}/g, ' ');
      }
      node.nodeValue = value;
    }
  }
}
