// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.filterAttributes = function(doc, options) {

  if(!options.FILTER_ATTRIBUTES) {
    return;
  }

  var elements = doc.body.getElementsByTagName('*');
  lucu.element.forEach(elements, lucu.calamine.filterElementAttributes);
};

lucu.calamine.filterElementAttributes = function(element) {

  // NOTE: is there a better way to get a list of the attributes for
  // an element? I just want the names, not name value pairs

  // NOTE: if i ever refactor to use streams and such this is probably
  // a candidate (e.g. array.filterMap(filterFn, mapFn)).

  var removeAttribute = Element.prototype.removeAttribute.bind(element);
  var filter = Array.prototype.filter;
  var isRemovable = lucu.calamine.isRemovableAttribute;
  var removables = filter.call(element.attributes, isRemovable);
  var names = removables.map(lucu.calamine.getAttributeName);
  names.forEach(removeAttribute);
};

lucu.calamine.getAttributeName = function(attribute) {
  return attribute.name;
};

lucu.calamine.isRemovableAttribute = function(attribute) {

  var name = attribute.name;

  if('href' == name) {
    return false;
  }

  if('src' == name) {
    return false;
  }

  return true;
};
