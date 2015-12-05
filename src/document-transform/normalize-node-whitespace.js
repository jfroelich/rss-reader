// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// NOTE: this should not be confused with Node.prototype.normalize
function normalizeNodeWhitespace(document) {
  'use strict';

	const it = document.createNodeIterator(document.documentElement,
		NodeFilter.SHOW_TEXT);
	let node = it.nextNode();
	let value = null;
	while(node) {
		value = node.nodeValue;

		// Skip over some common whitespace nodes to reduce the
		// number of regexp calls. This turns out to be a substantial
    // performance improvement.
    // TODO: use a table lookup?
		if(value === '\n' ||
			value === '\n\t' ||
			value === '\n\t\t') {
			node = it.nextNode();
			continue;
		}

		// Normalize non-breaking space entity
		value = value.replace(/&nbsp;/g, ' ');

		// Condense consecutive whitespace
		// TODO: test
		//value = value.replace(/[ ]{2,}/g, ' ');

		node.nodeValue = value;

		node = it.nextNode();
	}
}
