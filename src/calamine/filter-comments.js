// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.filterComments = function(doc) {

  var remover = lucu.node.remove;

  // TEMP: testing alternate syntax for removal
  // var remover = Node.prototype.remove;

  // Ok, I think the above does not work because there is no
  // such thing as Node.prototype.remove.  There is
  // Element.prototype.remove, however, so other places can
  // maybe use that




  lucu.node.forEach(doc.body, NodeFilter.SHOW_COMMENT, remover);
};
