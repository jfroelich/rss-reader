// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: responsive design allows images to have a srcset, maybe permit
// TODO: only allow the retainable attributes on the proper elements that can
// have them, instead of on any element (e.g. only images can have a src
// attribute)

// Removes attributes from elements in the document
function filterElementAttributes(document) {
  'use strict';

  const RETAIN_ATTRIBUTE_NAMES = new Set([
    'alt',
    'href',
    'src',
    // New HTML responsive design in images
    'srcset',
    'title'
  ]);

  const elements = document.getElementsByTagName('*');
  let attributes = null;
  let name = '';
  let element = null;
  for(let i = 0, j = 0, len = elements.length; i < len; i++) {
    element = elements[i];

    // Skip SVG
    // TODO: but what about onclick and such? this would be a security hole
    // TODO: leaving in SVG turns out to cause some funky display issues,
    // so this requires more thought. For example, I observed an article where
    // the SVG element was permanently floating in higher layer over the
    // article's actual text, making the article unreadable.
    // TODO: maybe svg and path should just be blacklisted
    if(element.localName === 'svg' || element.localName === 'path') {
      continue;
    }

    attributes = element.attributes;

    if(!attributes) {
      continue;
    }

    // NOTE: we iterate in reverse to avoid issues with mutating a live
    // NodeList while iterating
    for(j = attributes.length - 1; j > -1; j--) {
      name = attributes[j].name;
      if(!RETAIN_ATTRIBUTE_NAMES.has(name)) {
        element.removeAttribute(name);
      }
    }
  }
}
