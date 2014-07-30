// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';


function calamineIsRemovableAttribute(attribute) {
  return attribute.name != 'href' && attribute.name != 'src';
}

function calamineFilterElementAttributes(element) {

  var attributes = Array.prototype.filter.call(
    element.attributes, calamineIsRemovableAttribute);

  var names = attributes.map(function(attribute) {
    return attribute.name;
  });

  var removeAttribute = Element.prototype.removeAttribute.bind(element);
  names.forEach(removeAttribute);
}
