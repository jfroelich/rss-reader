// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.filterInvisibleElements = function(doc) {

  // NOTE: one idea about noscript handling is to show it
  // but avoid removing it here even if it is invisible
  // like, filterIfInvisibleAndNotNoscript...

  var elements = doc.body.querySelectorAll('*');
  var invisibles = lucu.element.filter(elements,
    lucu.calamine.isInvisible);
  invisibles.forEach(lucu.node.remove);
};

/**
 * Returns true if an element is invisible according to our own very
 * simplified definition of visibility. We are really only going after some
 * common tactics like using display:none for progressive loading or SEO
 */
lucu.calamine.isInvisible = function(element) {

  // NOTE: element.offsetWidth < 1 || element.offsetHeight < 1; ??
  // saw that somewhere, need to read up on offset props again.
  // Something about emulating how jquery does it?

  return element.style.display == 'none' ||
      element.style.visibility == 'hidden' ||
      parseInt(element.style.opacity) === 0;
};
