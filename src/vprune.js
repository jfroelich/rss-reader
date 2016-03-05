// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Pruning functions for VNodes

// TODO: using multiple passes appears to be slow. do a single walk and mutate
// as we go. so do an explicit walk so i dont have to deal with all the strange
// communications back to the walker function on where to go next. very much
// like the original approach i used to sanitize 2 years ago.

var VPrune = {};

VPrune.prepareDocumentForView = function(document) {
  'use strict';

  const vd = VNode_translate(document.documentElement);

  VPrune.filterCommentNodes(vd);
  VPrune.filterFrameElements(vd);
  VPrune.filterScriptElements(vd);
  VPrune.filterNoScriptElements(vd);
  VPrune.filterJavascriptAnchors(vd);
  VPrune.filterBlacklistedElements(vd);
  VPrune.filterHiddenElements(vd);
  // VPrune.filterBreakruleElements(vd);

  // Filter boilerplate using Calamine
  //const calamine = new Calamine();
  //calamine.analyze(cd);
  //calamine.prune();

  VPrune.filterSourcelessImages(vd);
  VPrune.filterTracerImages(vd);
  VPrune.normalizeWhitespace(vd);
  //VPrune.filterInlineElements(vd);

  const sensitiveElements = VPrune.getSensitiveSet(vd);
  VPrune.condenseNodeValues(vd, sensitiveElements);
  VPrune.filterNominalAnchors(vd);
  //VPrune.trimTextNodes(vd, sensitiveElements);

  VPrune.filterEmptyTextNodes(vd);

  // VPrune.filterLeafElements(vd);
  // VPrune.filterSingleItemLists(vd);
  // VPrune.filterSingleCellTables(vd);
  // VPrune.filterSingleColumnTables(vd);
  VPrune.trimDocument(vd);
  VPrune.filterAttributes(vd);

  // TODO: optimize
  const modified = VNode_translate(vd);
  document.documentElement.innerHTML = modified.innerHTML;
};

VPrune.findImageCaption = function(image) {
  'use strict';
  function isFigure(node) {
    return node.name === 'figure';
  }

  function isFigCaption(node) {
    return node.name === 'figcaption';
  }

  const figure = image.closest(isFigure, false);
  return figure ? figure.find(isFigCaption, false) : null;
};

VPrune.removeAll = function(nodes) {
  'use strict';
  for(let i = 0, len = nodes.length; i < len; i++) {
    nodes[i].remove();
  }
};

// TODO: i am not sure how removal while iterating works at the moment,
// so for now this collects all comments first in a static array then
// removes after iteration is completed
VPrune.filterCommentNodes = function(node) {
  'use strict';

  function isComment(node) {
    return node.type === VNode_COMMENT;
  }

  const comments = node.findAll(isComment, false);
  VPrune.removeAll(comments);
};

VPrune.isBlacklisted = function(node) {
  'use strict';
  if(node.type !== VNode_ELEMENT) {
    return false;
  }
  switch(node.name) {
    case 'applet':
    case 'object':
    case 'embed':
    case 'param':
    case 'video':
    case 'audio':
    case 'bgsound':
    case 'head':
    case 'meta':
    case 'title':
    case 'datalist':
    case 'dialog':
    case 'fieldset':
    case 'isindex':
    case 'math':
    case 'output':
    case 'optgroup':
    case 'progress':
    case 'spacer':
    case 'xmp':
    case 'style':
    case 'link':
    case 'basefont':
    case 'select':
    case 'option':
    case 'textarea':
    case 'input':
    case 'button':
    case 'command':
      return true;
    default:
      return false;
  }
};

VPrune.filterBlacklistedElements = function(node) {
  'use strict';

  const matches = node.findAllShallow(VPrune.isBlacklisted, true);

  VPrune.removeAll(matches);
};

// Replaces <br> elements within a document with <p>
// TODO: this function needs some substantial improvement. there are several
// problems with its current approach, such as what happens when inserting
// a paragraph element within an inline element.
// error case: http://paulgraham.com/procrastination.html
VPrune.filterBreakruleElements = function(node) {
  'use strict';
  const breaks = node.findAll(function(node) {
    return node.name === 'br';
  }, false);

  for(let i = 0, len = breaks.length; i < len; i++) {
    let br = breaks[i];
    let parent = br.parentElement;
    let p = VNode.createElement('p');
    parent.replaceChild(p, br);
  }
};

VPrune.filterAttributes = function(node) {
  'use strict';
  node.traverse(function(node) {
    if(node.type !== VNode_ELEMENT)
      return;
    const elementName = node.name;
    if(elementName === 'svg' || elementName === 'path')
      return;
    const attributes = node.attributes || {};
    for(let name in attributes) {
      if(!VPrune.isPermittedAttribute(name, attributes[name])) {
        node.removeAttribute(name);
      }
    }
  }, true);
};

VPrune.isPermittedAttribute = function(elementName, attributeName) {
  'use strict';
  let isPermitted = false;
  switch(elementName) {
    case 'a':
      isPermitted = attributeName === 'href' || attributeName === 'name' ||
        attributeName === 'title';
      break;
    case 'html':
      isPermitted = attributeName === 'lang';
      break;
    case 'iframe':
      isPermitted = attributeName === 'src';
      break;
    case 'img':
      isPermitted = attributeName === 'alt' || attributeName === 'src' ||
        attributeName === 'srcset' || attributeName === 'title';
      break;
    case 'param':
      isPermitted = attributeName === 'name' || attributeName === 'value';
      break;
    default:
      break;
  }
  return isPermitted;
};

VPrune.filterFrameElements = function(node) {
  'use strict';
  let body = node.body;

  let frameset = null;
  for(let childElement = node.firstElementChild; childElement;
    childElement = childElement.nextElementSibling) {
    if(childElement.name === 'frameset') {
      frameset = childElement;
      break;
    }
  }

  if(!body && frameset) {
    // TODO: use a more restrictive location
    const noframes = frameset.find(function isNoframes(node) {
      return node.type === VNode_ELEMENT && node.name === 'noframes';
    }, false);

    body = VNode.createElement('body');
    if(noframes) {
      noframes.traverse(function appendToBody(node) {
        body.appendChild(node);
      }, false);
    } else {
      body.textContent = 'Unable to display document due to frames.';
    }

    node.appendChild(body);
    frameset.remove();

  } else {
    const framesets = node.getElementsByName('frameset');
    VPrune.removeAll(framesets);
    const frames = node.getElementsByName('frame');
    VPrune.removeAll(frames);
    const iframes = node.getElementsByName('iframe');
    VPrune.removeAll(iframes);
  }
};

VPrune.filterHiddenElements = function(node) {
  'use strict';
  const matches = node.findAllShallow(function(node) {
    const style = node.type === VNode_ELEMENT && node.getAttribute('style');
    // TODO: the opacity check has false positives like opacity: 0.9
    return
      /(display:\s*none)|(visibility:\s*hidden)|(opacity:\s*0)/i.test(style);
  }, true);
  VPrune.removeAll(matches);
};

VPrune.filterNominalAnchors = function(node) {
  'use strict';

  const anchors = node.getElementsByName('a', false);
  for(let i = 0, anchor, href, len = anchors.length; i < len; i++) {
    anchor = anchors[i];
    if(!anchor.hasAttribute('name')) {
      href = anchor.getAttribute('href') || '';
      if(href) {
        href = href.trim();
      }
      if(!href) {
        VPrune.unwrap(anchor);
      }
    }
  }
};

VPrune.filterScriptElements = function(node) {
  'use strict';
  const elements = node.getElementsByName('script', false);
  VPrune.removeAll(elements);
};

VPrune.filterNoScriptElements = function(node) {
  'use strict';
  const elements = node.getElementsByName('noscript', false);
  VPrune.removeAll(elements);
};

VPrune.filterJavascriptAnchors = function(node) {
  'use strict';
  const isJavascriptAnchor = function(node) {
    if(node.name === 'a') {
      const href = node.getAttribute('href');
      return href && /^\s*javascript\s*:/i.test(href);
    }
  };
  const matches = node.findAll(isJavascriptAnchor, false);
  for(let i = 0, len = matches.length; i < len; i++) {
    matches[i].setAttribute('href', '');
  }
};

VPrune.filterSourcelessImages = function(node) {
  'use strict';
  const isSourcelessImage = function(node) {
    return node.name === 'img' && !node.hasAttribute('src')
      && !node.hasAttribute('srcset');
  };
  const images = node.findAll(isSourcelessImage, false);
  VPrune.removeAll(images);
};

VPrune.filterTracerImages = function(node) {
  'use strict';
  const isTracerImage = function(node) {
    return node.name === 'img' && (node.width < 2 || node.height < 2);
  };
  const images = node.findAll(isTracerImage, false);
  VPrune.removeAll(images);
};

VPrune.normalizeWhitespace = function(node) {
  'use strict';
  node.traverse(function normalizeNodeWhitespace(node) {
    if(node.type !== VNode_TEXT)
      return;
    switch(node.value) {
      case null:
      case undefined:
      case '':
      case '\n':
      case '\n\t':
      case '\n\t\t':
      case '\n\t\t\t':
      case '\n\t\t\t\t':
      case '\n\t\t\t\t\t':
        break;
      default:
        node.value = node.value.replace(/&nbsp;/g, ' ');
        break;
    }
  }, false);
};

VPrune.isSensitiveElement = function(node) {
  'use strict';
  const name = node.name;
  return node.type === VNode_ELEMENT && (name === 'code' || name === 'pre' ||
    name === 'ruby' || name === 'textarea' || name === 'xml');
};

VPrune.getSensitiveSet = function(node) {
  'use strict';

  // TODO: this has extremely bad performance
  if(true) {
    return new Set();
  }

  const elements = node.findAll(function isSensitive(node) {
    return node.closest(VPrune.isSensitiveElement, true);
  }, true);
  return new Set(elements);
};

VPrune.condenseNodeValues = function(node, sensitiveElements) {
  'use strict';
  node.traverse(function condenseTextNode(node) {
    const value = node.value;
    if(node.type === VNode_TEXT && value &&
      !sensitiveElements.has(node.parentNode)) {
      node.value = value.replace(/\s{2,}/g, ' ');
    }
  }, false);
};

VPrune.trimDocument = function(rootNode) {
  'use strict';
  const body = rootNode.body;
  if(!body) {
    return;
  }

  let sibling = body;
  let node = body.firstChild;
  while(node && VPrune.isTrimmable(node)) {
    sibling = node.nextSibling;
    node.remove();
    node = sibling;
  }

  node = body.lastChild;
  while(node && VPrune.isTrimmable(node)) {
    sibling = node.previousSibling;
    node.remove();
    node = sibling;
  }
};

VPrune.isTrimmable = function(node) {
  'use strict';
  if(node.type === VNode_ELEMENT) {
    switch(node.name) {
      case 'br':
      case 'hr':
      case 'nobr':
        return true;
      case 'p':
      case 'blockquote':
      case 'div':
        return !node.firstChild;
      default:
        break;
    }
  }
  return false;
};

VPrune.filterEmptyTextNodes = function(node) {
  'use strict';
  const nodes = node.findAll(function isEmptyTextNode(node) {
    return node.type === VNode_TEXT && !node.value;
  }, false);
  VPrune.removeAll(nodes);
};

VPrune.unwrap = function(node) {
  'use strict';
  const parent = node.parentNode;
  if(parent) {
    parent.insertBefore(VNode.createTextNode(' '), node);
    for(let child = node.firstChild; child; child = node.firstChild) {
      parent.insertBefore(child, node);
    }
    parent.insertBefore(VNode.createTextNode(' '), node);
  }
  node.remove();
};
