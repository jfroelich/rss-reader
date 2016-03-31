// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Lib for filtering the contents of an HTML Document object
// Requires: /src/sanity-attribute.js
// Requires: /src/sanity-leaf.js
// Requires: /src/sanity-table.js
// Requires: /src/sanity-unwrap.js

// TODO: explicit handling of noembed/audio/video/embed
// TODO: explicit handling of noscript
// TODO: include aria hidden in SANITY_HIDDEN_SELECTOR?
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden
// TODO: research why content sometimes appears garbled, like encoded, as if
// it is re-encoding html, when using content of noframes in
// sanity_replace_frames
// TODO: what if both body and frameset are present in sanity_replace_frames ?
// TODO: maybe blacklist all urls not using an acceptable protocol in
// sanity_filter_anchors

function sanity_sanitize_document(document) {
  'use strict';
  sanity_filter_comments(document);
  sanity_replace_frames(document);
  sanity_filter_blacklisted_elements(document);
  sanity_filter_hidden_elements(document);
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

var SANITY_BLACKLIST_SELECTOR = [
  'APPLET', 'AUDIO', 'BASE', 'BASEFONT', 'BGSOUND', 'BUTTON', 'COMMAND',
  'DATALIST', 'DIALOG', 'EMBED', 'FIELDSET', 'FRAME', 'FRAMESET', 'HEAD',
  'IFRAME', 'INPUT', 'ISINDEX', 'LINK', 'MATH', 'META', 'NOSCRIPT',
  'OBJECT', 'OUTPUT', 'OPTGROUP', 'OPTION', 'PARAM', 'PATH', 'PROGRESS',
  'SCRIPT', 'SELECT', 'SPACER', 'STYLE', 'SVG', 'TEXTAREA', 'TITLE',
  'VIDEO', 'XMP'
].join(',');

function sanity_filter_blacklisted_elements(document) {
  'use strict';
  const elements = document.querySelectorAll(SANITY_BLACKLIST_SELECTOR);
  const docElement = document.documentElement;
  for(let i = 0, len = elements.length, element; i < len; i++) {
    element = elements[i];
    if(docElement.contains(element)) {
      element.remove();
    }
  }
}

var SANITY_HIDDEN_SELECTOR = [
  '[style*="display:none"]', '[style*="display: none"]',
  '[style*="visibility:hidden"]', '[style*="visibility: hidden"]',
  '[style*="opacity:0.0"]'
].join(',');

function sanity_filter_hidden_elements(document) {
  'use strict';

  const elements = document.querySelectorAll(SANITY_HIDDEN_SELECTOR);
  const docElement = document.documentElement;
  for(let i = 0, len = elements.length, element; i < len; i++) {
    element = elements[i];
    if(docElement.contains(element)) {
      element.remove();
    }
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

function sanity_replace_frames(document) {
  'use strict';

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

  const anchors = document.querySelectorAll('A');
  const jspattern = /^\s*JAVASCRIPT\s*:/i;
  const MIN_HREF_LEN = 'JAVASCRIPT'.length;

  for(let i = 0, len = anchors.length, anchor, href; i < len; i++) {
    anchor = anchors[i];
    if(anchor.hasAttribute('href')) {
      href = anchor.getAttribute('href');
      if(href.length > MIN_HREF_LEN && jspattern.test(href)) {
        // NOTE: consider removing or unwrapping
        anchor.setAttribute('href', '');
      }
    } else if(!anchor.hasAttribute('name')) {
      sanity_unwrap(anchor);
    }
  }
}

function sanity_filter_lists(document) {
  'use strict';

  const lists = document.querySelectorAll('UL, OL');
  for(let i = 0, len = lists.length, list, item; i < len; i++) {
    list = lists[i];
    if(list.childElementCount === 1) {
      item = list.firstElementChild;
      if(item.nodeName === 'LI') {
        sanity_insert_children_before(item, list);
        list.remove();
      }
    }
  }
}

function sanity_filter_consecutive_rules(document) {
  'use strict';

  for(let i = 0, rules = document.querySelectorAll('HR'), len = rules.length,
    rule, prev; i < len; i++) {
    prev = rules[i].previousSibling;
    if(prev && prev.nodeName === 'HR') {
      prev.remove();
    }
  }
}

function sanity_filter_consecutive_break_rules(document) {
  'use strict';

  const breaks = document.querySelectorAll('BR');
  for(let i = 0, len = breaks.length, prev; i < len; i++) {
    prev = breaks[i].previousSibling;
    if(prev && prev.nodeName === 'BR') {
      prev.remove();
    }
  }
}

function sanity_replace_break_rules(document) {
  'use strict';

  const elements = document.querySelectorAll('BR');
  for(let i = 0, len = elements.length, element; i < len; i++) {
    element = elements[i];
    sanity_filter_break_rule(element);
  }
}

// TODO: improve, this is very buggy
// error case: http://paulgraham.com/procrastination.html
function sanity_filter_break_rule(element) {
  'use strict';

  const parent = element.parentNode;
  const p = document.createElement('P');
  parent.replaceChild(p, element);
}

function sanity_filter_images(document) {
  'use strict';

  const images = document.querySelectorAll('IMG');
  for(let i = 0, len = images.length, image; i < len; i++) {
    image = images[i];
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      image.remove();
    } else if(image.width < 2 || image.height < 2) {
      image.remove();
    }
  }
}

function sanity_trim_document(document) {
  'use strict';

  const body = document.body;
  if(!body) {
    return;
  }

  const firstChild = body.firstChild;
  if(firstChild) {
    sanity_remove_trimmable_nodes_by_step(firstChild, 'nextSibling');
    const lastChild = body.lastChild;
    if(lastChild && lastChild !== firstChild) {
      sanity_remove_trimmable_nodes_by_step(body.lastChild, 'previousSibling');
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

  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  const SENSITIVE_SELECTOR = 'CODE, PRE, RUBY, TEXTAREA, XMP';
  for(let node = iterator.nextNode(), value, length = 0; node;
    node = iterator.nextNode()) {
    value = node.nodeValue;
    length = value.length;
    if(length > 3) {
      if(length > 5) {
        value = value.replace(/&nbsp;/ig, ' ');
      }
      if(!node.parentNode.closest(SENSITIVE_SELECTOR)) {
        value = value.replace(/\s{2,}/g, ' ');
      }
      node.nodeValue = value;
    }
  }
}
