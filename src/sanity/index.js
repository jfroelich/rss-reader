// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Lib for filtering the contents of an HTML Document object
// Requires: /src/dom.js
// Requires: /src/sanity/attribute.js
// Requires: /src/sanity/blacklist.js
// Requires: /src/sanity/condense-whitespace.js
// Requires: /src/sanity/image.js
// Requires: /src/sanity/leaf.js
// Requires: /src/sanity/table.js
// Requires: /src/sanity/trim.js
// Requires: /src/sanity/unwrap.js
// Requires: /src/sanity/visibility.js
// Requires: /src/string.js

// TODO: research why some articles appear without content. I know pdfs
// work this way, but look into the issue with other ones.

// TODO: look into issues with rendering google groups pages.
// For example:
// view-source:https://groups.google.com/forum/#!topic/golang-nuts/MmSbFHLPo8g
// The content in the body after the <xmp>.<xmp> shows up as encoded? Maybe
// it is due to the single <plaintext/> tag preceding it? I can't tell what is
// going on. Does chrome's html parser screw up?

// TODO: explicit handling of noembed/audio/video/embed

// TODO: maybe I should have some other function
// that deals with malformed html and removes all nodes that do not conform
// to <html><head>*</head><body>*</body></html> and then none of the sanity
// functions need to be concerned.

// TODO: if I have no use for nodes outside of body, maybe it makes sense to
// just explicitly removal all such nodes.

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
// Another issue with that page is flow formatting, maybe I want to correct
// this or maybe I want to allow it, not sure. Specifically H1s within anchors

// TODO: there are quirks with malformed html. See this page
// http://blog.hackerrank.com/step-0-before-you-do-anything/
// It has an error with a noscript node. The guy forgot the < to start the
// nested script tag in it. So, part of its contents becomes a text node. This
// text node is somehow the first text node of the body in the DOM hierarchy
// represented to me in JS, even though it is not located within the body.
// Because it isn't filtered by the blacklist or anything, it shows up really
// awkwardly within the output as the first piece of body text.
// NOTE: filtering the nodes out of the body won't help.

// Applies a hardcoded series of filters to a document. Modifies the document
// in place.
function sanity_sanitize_document(document) {
  'use strict';
  sanity_filter_comments(document);
  sanity_replace_frames(document);
  sanity_filter_noscripts(document);
  sanity_filter_blacklisted_elements(document);
  sanity_filter_hidden_elements(document);
  sanity_replace_break_rules(document);
  sanity_filter_anchors(document);
  no_track_filter_tiny_images(document);
  sanity_filter_images(document);
  sanity_filter_unwrappables(document);
  sanity_filter_figures(document);
  sanity_condense_whitespace(document);
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


function sanity_filter_comments(document) {
  'use strict';

  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let comment = it.nextNode(); comment; comment = it.nextNode()) {
    comment.remove();
  }
}


// TODO: what if both body and frameset are present?
// TODO: there can be multiple bodies when illformed. Maybe use
// querySelectorAll and handle multi-body branch differently
function sanity_replace_frames(document) {
  'use strict';

  const framesetElement = document.body;
  if(!framesetElement || framesetElement.nodeName !== 'FRAMESET') {
    return;
  }

  const bodyElement = document.createElement('BODY');
  const noframes = document.querySelector('NOFRAMES');
  if(noframes) {
    for(let node = noframes.firstChild; node; node = noframes.firstChild) {
      bodyElement.appendChild(node);
    }
  } else {
    const errorTextNode = document.createTextNode(
      'Unable to display framed document.');
    bodyElement.appendChild(errorTextNode);
  }

  framesetElement.remove();
  document.documentElement.appendChild(bodyElement);
}

function sanity_filter_anchors(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  // This looks for anchors that contain inline script. I tested using
  // anchor.protocol === 'javascript:' and found that it was subtantially
  // slower than using a RegExp.

  const anchors = bodyElement.querySelectorAll('A');
  const numAnchors = anchors.length;
  const JS_PATTERN = /^\s*JAVASCRIPT\s*:/i;
  const MIN_HREF_LEN = 'JAVASCRIPT:'.length;

  // NOTE: hasAttribute is true for empty attribute values, but I am not
  // concerned with this at the moment.

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

// Unwrap lists with only one item.
function sanity_filter_lists(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const ITEM_ELEMENT_NAMES = {'LI': 1, 'DT': 1, 'DD': 1};

  const listNodeList = bodyElement.querySelectorAll('UL, OL, DL');
  const nodeListLength = listNodeList.length;
  for(let i = 0, listElement, itemElement; i < nodeListLength; i++) {
    listElement = listNodeList[i];
    if(listElement.childElementCount === 1) {
      itemElement = listElement.firstElementChild;
      if(itemElement.nodeName in ITEM_ELEMENT_NAMES) {
        listElement.parentNode.insertBefore(document.createTextNode(' '),
          listElement);
        dom_insert_children_before(itemElement, listElement);
        listElement.parentNode.insertBefore(document.createTextNode(' '),
          listElement);
        listElement.remove();
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

// TODO: improve, this is very buggy
// error case: http://paulgraham.com/procrastination.html
function sanity_replace_break_rules(document) {
  'use strict';

  // NOTE: Due to buggy output this is a no-op for now
  if(true) {
    return;
  }

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const nodeList = bodyElement.querySelectorAll('BR');
  const listLength = nodeList.length;

  for(let i = 0, brElement, parent, p; i < listLength; i++) {
    brElement = nodeList[i];

    brElement.renameNode('p');

    //parent = brElement.parentNode;
    //p = document.createElement('P');
    //parent.replaceChild(p, brElement);
  }
}

// If a figure has only one child element image, then it is useless.
// NOTE: boilerplate analysis examines figures, so ensure this is not done
// before it.
function sanity_filter_figures(document) {
  'use strict';

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const figures = bodyElement.querySelectorAll('FIGURE');
  const numFigures = figures.length;
  for(let i = 0, figure; i < numFigures; i++) {
    figure = figures[i];
    if(figure.childElementCount === 1) {
      // console.debug('Unwrapping basic figure:', figure.outerHTML);
      dom_unwrap(figure, null);
    }
  }
}
