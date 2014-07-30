// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.css = {};

//Finds first matching CSS rule by selectorText query.
lucu.css.findRule = function(sheet, selectorText) {

  if(!sheet) {
    return;
  }

  var rules = sheet.cssRules;

  // TODO: use a partial instead of an outer scope ref

  var matches = Array.prototype.filter.call(rules, function(rule) {
    return rule.selectorText == selectorText;
  });

  // TODO: is the length check even necessary?
  if(matches.length) {
    return matches[0];
  }
};
