// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

/*
One possible issue with this is that is screws over the anchor
density metric. Maybe a better tactic would be to just empty
the href value in this case? Or remove the href attribute?

Removing the href attribute would mean that anchor desntiy would
still be effected.  The function in derive-anchor-features just
requires the presence of the href attribute to derive
anchorCharCount. Therefore the best best would be to set it
to empty?

But then this leads to the problem if the anchor makes it through
the gauntlet, in that we end up presenting bad anchors to the viewer

Maybe we could later filter out empty href attributes? That isn't
just normal minification that has a semantic effect on the text so
it would be important.

Or we could remove the has-href check in derive-anchor-features?
*/

lucu.calamine.unwrapJavascriptAnchors = function(doc) {

  var anchors = doc.body.querySelectorAll('a[href]');
  var scriptAnchors = lucu.element.filter(anchors,
    lucu.calamine.isJavascriptAnchor);

  scriptAnchors.forEach(lucu.element.unwrap);
};

lucu.calamine.isJavascriptAnchor = function(anchor) {
  var href = anchor.getAttribute('href');
  return /^\s*javascript\s*:/i.test(href);
};
