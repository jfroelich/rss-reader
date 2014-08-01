// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.deriveAttributeFeatures = function(doc) {
  var elements = doc.body.getElementsByTagName('*');
  lucu.element.forEach(elements,
    lucu.calamine.deriveAttributeFeaturesForElement);
};

// Store id and class attribute values
lucu.calamine.deriveAttributeFeaturesForElement = function(element) {

  // Stash props before attributes are removed

  // TODO: this feels dumb. Why not just score before removing attributes
  // and avoid this step entirely? The section of the scoring code that
  // scores based on attributes can do the lookup at that point

  var text = (element.getAttribute('id') || '');
  text += ' ';
  text += (element.getAttribute('class') || '');
  text = text.trim().toLowerCase();

  if(text) {
    element.attributeText = text;
  }
};
