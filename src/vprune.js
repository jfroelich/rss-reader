// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Pruning functions for VNodes

var VPrune = {};

VPrune.findImageCaption = function(image) {
  'use strict';
  const isFigure = function(node) {
    return node.name === 'figure';
  };
  const isFigCaption = function(node) {
    return node.name === 'figcaption';
  };
  const figure = image.closest(isFigure, false);
  return figure ? figure.find(isFigCaption, false) : null;
};

VNode.removeAll = function(nodes) {
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
  const isComment = function(node) {
    return node.type === VNode.COMMENT;
  };
  const comments = node.findAll(isComment, false);
  VPrune.removeAll(comments);
};

VPrune.DEFAULT_BLACKLIST = new Set([
  'applet',
  'object',
  'embed',
  'param',
  'video',
  'audio',
  'bgsound',
  'head',
  'meta',
  'title',
  'datalist',
  'dialog',
  'fieldset',
  'isindex',
  'math',
  'output',
  'optgroup',
  'progress',
  'spacer',
  'xmp',
  'style',
  'link',
  'basefont',
  'select',
  'option',
  'textarea',
  'input',
  'button',
  'command'
]);

// @param customBlacklist {Set} lowercase element names to remove
VPrune.filterBlacklistedElements = function(node, customBlacklist) {
  'use strict';
  // TODO: not quite comfortable yet with mutation while iterating so for now
  // this collects matches into a static array first
  const blacklist = customBlacklist || VPrune.DEFAULT_BLACKLIST;
  const isBlacklisted = function(node) {
    return node.type === VNode.ELEMENT && blacklist.has(node.name);
  };
  const matches = node.findAllShallow(isBlacklisted, true);
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
    if(node.type !== VNode.ELEMENT)
      return;
    const elementName = node.name;
    if(elementName === 'svg' || elementName === 'path')
      return;
    const attributes = node.attributes || [];
    for(let entry of attributes) {
      if(!VPrune.isPermittedAttribute(elementName, entry[0])) {
        node.removeAttribute(entry[0]);
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
  if(node.type !== VNode.ELEMENT || node.name !== 'html' || node.parentNode) {
    return;
  }

  let body = node.body;

  // TODO: this matches a frameset anywhere. Use a more restricted
  // query that only looks in the proper locations
  const frameset = node.find(function(node) {
    return node.name === 'frameset';
  }, true);

  if(!body && frameset) {
    // TODO: use a more restrictive location
    const noframes = frameset.find(function(node) {
      return node.name === 'noframes';
    }, false);

    body = VNode.createElement('body');
    if(noframes) {
      noframes.traverse(function(node) {
        body.appendChild(node);
      }, false);
    } else {
      body.textContent = 'Unable to display document due to frames.';
    }

    node.appendChild(body);
    frameset.remove();
    return;
  }

  const matches = node.findAllShallow(function(node) {
    const name = node.name;
    return name === 'frame' || name === 'frameset' || name === 'iframe';
  }, false);
  VPrune.removeAll(matches);
};

VPrune.filterHiddenElements = function(node) {
  'use strict';
  const matches = node.findAllShallow(function(node) {
    const value = node.type === VNode.ELEMENT && node.getAttribute('style');
    // TODO: the opacity check has false positives like opacity: 0.9
    // TODO: use a single regexp call, using |, for performance
    // TODO: is a space preceding : allowed?
    return value && (/display\s*:\s*none/i.test(value) ||
      /visibility\s*:\s*hidden/i.test(value) ||
      /opacity\s*:\s*0/i.test(value));
  }, true);
  VPrune.removeAll(matches);
};

VPrune.filterNominalAnchors = function(node) {
  'use strict';
  const isAnchor = function(node) {
    return node.name === 'a';
  };
  const anchors = node.findAll(isAnchor, false);
  for(let i = 0, anchor, href, len = anchors.length; i < len; i++) {
    anchor = anchors[i];
    if(!anchor.hasAttribute('name')) {
      href = anchor.getAttribute('href') || '';
      href = href.trim();
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
    return node.name === 'img' && (image.width < 2 || image.height < 2);
  };
  const images = node.findAll(isTracerImage, false);
  VPrune.removeAll(images);
};

VPrune.normalizeWhitespace = function(node) {
  'use strict';
  node.traverse(function(node) {
    if(node.type !== VNode.TEXT)
      return;
    switch(node.value) {
      case null:
      case undefined:
      case '':
      case '\n':
      case '\n\t':
      case '\n\t\t':
      case '\n\t\t\t':
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
  return node.type === VNode.ELEMENT && (name === 'code' || name === 'pre' ||
    name === 'ruby' || name === 'textarea' || name === 'xml');
};

VPrune.getSensitiveSet = function(node) {
  'use strict';
  const elements = node.findAll(function(node) {
    return node.closest(VPrune.isSensitiveElement, true);
  }, true);
  return new Set(elements);
};

VPrune.condenseNodeValues = function(node, sensitiveElements) {
  'use strict';
  node.traverse(function(node) {
    if(node.type === VNode.TEXT && node.value &&
      !sensitiveElements.has(node.parentElement)) {
      node.value = node.value.replace(/  +/g, ' ');
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
  if(node.type !== VNode.ELEMENT)
    return false;
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
  return false;
};

VPrune.filterEmptyTextNodes = function(node) {
  'use strict';
  const nodes = node.findAll(function(node) {
    return node.type === VNode.TEXT && !node.value;
  }, false);
  VNode.removeAll(nodes);
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
