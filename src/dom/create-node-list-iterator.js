// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Create a custom iterator wrapper around NodeList because
// I do not want to modify NodeList.prototype and Chrome does not yet
// support iterable node lists. So this is a placeholder function to remind me
// of this idea of how to allow all my other iterating functions that work
// with nodelists to use for..of.
// This is not currently in use anywhere.

function createNodeListIterator(nodeList) {
  'use strict';
  throw new Error('Not implemented');
}
