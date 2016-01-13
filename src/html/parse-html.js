// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Parses the html string and returns a Document object
// NOTE: is practically equivalent to using DOMParser. I took a look a while
// ago at the internals of DOMParser in webkit/chrome and it basically
// does the exact same thing. one issue though is whether domparser sets
// the body inner html or the documentelement innerhtml. this would be something
// to review.
// NOTE: we do not need to check whether the html variable is defined because
// setting the innerHTML property to undefined has no effect.
// NOTE: doc does not have an innerHTML property, so we have to use
// documentElement. Setting doc.innerHTML is basically only defining a new,
// useless, expando property on the document instance.
// TODO: review whether this throws an exception or does the funky embedded
// parsererror element like what happens when parsing invalid xml
// TODO: all functionality that involves parsing html in the app should be
// using this function. I think there are a few places in other files that do
// not use this.
// TODO: if the document element has only one child and it is <html>, the
// child should be unwrapped

function parseHTML(html) {
  'use strict';
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.innerHTML = html;
  return doc;
}
