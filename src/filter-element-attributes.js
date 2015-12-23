// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Removes attributes from elements in the document, except for href/src
function filterElementAttributes(document) {
  'use strict';

  const RETAIN_ATTRIBUTE_NAMES = new Set([
    'alt',
    'href',
    'src',
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
    if(element.localName === 'svg' || element.localName === 'path') {
      continue;
    }

    attributes = element.attributes;

    // NOTE: attributes is a live NodeList, so we iterate in reverse to
    // avoid issues with mutation while iterating.
    j = attributes ? attributes.length : 0;
    while(j--) {
      name = attributes[j].name;
      if(!RETAIN_ATTRIBUTE_NAMES.has(name)) {
        element.removeAttribute(name);
      }
    }
  }
}
