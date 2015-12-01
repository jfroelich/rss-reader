// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Removes all occurrences of the named element from the document
// TODO: belongs in DOMUtils, then delete this doc
function removeElementsByName(document, tagName) {
	const elements = document.getElementsByTagName(tagName);
	for(let i = elements.length - 1; i > -1; i--) {
		elements[i].remove();
	}
}

this.removeElementsByName = removeElementsByName;

} // END ANONYMOUS NAMESPACE
