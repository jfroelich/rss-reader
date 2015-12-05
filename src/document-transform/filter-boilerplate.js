// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Filters boilerplate from the document. This is the function that bridges
// the calamine lib with the transform suite.
function filterBoilerplate(document) {
  'use strict';

	const isContent = createCalamineClassifier(false, document);
	const garbage = document.implementation.createHTMLDocument();
	const elements = document.querySelectorAll('*');
	const length = elements.length;
	for(let i = 0, element; i < length; i++) {
		element = elements[i];

    // Check that the element is still located within the current document.
    // A previous iteration of this loop may have indirectly moved the element
    // to a different document by moving an ancestor, because we generally
    // are visiting nodes in top down order (using the in-document-order nature
    // of querySelectorAll).

		if(element.ownerDocument === document) {

      // If the element is still a part of the document, check whether the
      // element is content or boilerplate. If it is not content, then
      // remove the element from the document (by moving it).

      if(!isContent(element)) {
				garbage.adoptNode(element);
			}
		}
	}
}
