// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Removes all comment nodes from a document
// TODO: process IE conditional comments?
function filterCommentNodes(document) {
  'use strict';
	const iterator = document.createNodeIterator(
    document.documentElement,
		NodeFilter.SHOW_COMMENT);
	let comment = iterator.nextNode();
	while(comment) {
		comment.remove();
		comment = iterator.nextNode();
	}
}
