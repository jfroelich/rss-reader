// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const DOMUtils = {};

// Create a custom iterator wrapper around NodeList because
// I do not want to modify NodeList.prototype and Chrome does not yet
// support iterable node lists
DOMUtils.createNodeListIterator = function(nodeList) {
  throw new Error('Not implemented');
};
