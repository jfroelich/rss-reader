// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.filterComments = function(doc) {
  lucu.node.forEach(doc.body, NodeFilter.SHOW_COMMENT, lucu.node.remove);
};
