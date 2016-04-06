// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// DOM routines

// Appends source's child nodes to destination. The nodes are moved, not
// copied. Assumes source and destination are defined dom nodes.
// This is not optimized for moving attached nodes.
// The order of children is maintained.
// TODO: look into some way of doing this in batch instead of one node at a
// time. I have a feeling the suboptimal performance is because it is doing
// lots of wasted operations.
function dom_append_children(source, destination) {
  'use strict';

  // The confusing part of this is that as each child is appended, it is
  // removed from its previous parent, meaning that the next child becomes the
  // parent.firstChild node. This is why we reassign node to firstChild again
  // and not child.nextSibling.
  for(let node = source.firstChild; node; node = source.firstChild) {
    destination.appendChild(node);
  }
}
