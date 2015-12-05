// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file


// TODO: improve this. br is allowed in inline elements
// and this is shoving non-inline p into inline sometimes
// so we need to be able to break the inline context in
// half somehow
// error case: http://paulgraham.com/procrastination.html
function filterBreakruleElements(document) {
  'use strict';

	const elements = document.querySelectorAll('br');
	const length = elements.length;
	for(let i = 0; i < length; i++) {
		const element = elements[i];
		const parent = element.parentElement;
		const p = document.createElement('p');
		parent.replaceChild(p, element);
	}
}
