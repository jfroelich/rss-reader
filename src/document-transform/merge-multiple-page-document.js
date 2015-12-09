// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Note currently implemented. Just a placeholder for now. The idea is
// to investigate whether a page looks like it is spread over
// multiple pages, and if so, to get those other pages, merge
// them all together, and remove the paging elements

// Because we will be fetching other pages, this will be async, so we
// will use a callback that is called when the whole op completes

// The code for fetching a document may need to be made more general
// so that it can also be used here, although it is really rather
// simple html fetching

// TODO: think of a better name
// TODO: compare to domdistiller's technique
// TODO: compare to readability's technique

function mergeMultiplePageDocument(document, callback) {
  'use strict';

}
