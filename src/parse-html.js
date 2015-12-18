// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Parses the html string and returns a Document object
// NOTE: is practically equivalent to using DOMParser. I took a look a while 
// ago at the internals of DOMParser in webkit/chrome and it basically
// does the exact same thing. one issue though is whether domparser sets
// the body inner html or the documentelement innerhtml. this would be something
// to review.

// I feel like it
// makes sense to wrap it all up in an idiomatic function that abstracts away
// the details of how to do this, even though it is extremely basic in the end.

// TODO: review whether this throws an exception or does the funky embedded
// parsererror thing like what happens when parsing invalid xml
// TODO: all functionality that involves parsing html in the app should be
// using this function. I think there are a few places in other files that do
// not use this.
// TODO: should this be guarding against undefined html parameter? what is the
// behavior in that case?
function parseHTML(html) {
  'use strict';
  const doc = document.implementation.createHTMLDocument();
  // NOTE: doc does not have an innerHTML property, we have
  // to use documentElement
  doc.documentElement.innerHTML = html;
  return doc;
}
