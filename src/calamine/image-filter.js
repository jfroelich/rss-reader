// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.filterImage = function(image) {

  // I'd prefer not to do this check but it just removes the concern
  // regarding whether this is passed to querySelectorAll or
  // getElementsByTagName due to issues with iterating while removing
  if(!image) {
    return;
  }

  var source = image.getAttribute('src');
  if(source) {
    source = source.trim();
  }

  // Remove sourceless images. Technically we should never encounter such
  // images, and this filter's purpose is closer to minifying than
  // filtering for statistical reasons. I also am not clear how browsers
  // react to sourceless images, and whether behavior varies. I assume such
  // images would never be displayed and not affect layout. It would be
  // something to eventually learn about.
  if(!source) {
    lucu.node.remove(image);
    return;
  }

  // NOTE: I assume that tracker images are not a good indicator of whether
  // the containing element is boilerplate. They seem to be randomly
  // distributed. I admit my sample size is pretty small and this could turn
  // out to be incorrect, but I am fairly confident for now.
  // I suppose another way to look at it however, since we are not testing
  // both dimensions at once, is that another common technique before CSS
  // was widespread was the whole 1px width trick to simulate box-shadow. In that
  // sense, if the ratio of the image is something like 1px to 1000px or 1000px to
  // 1px, such images are indicators of section boundaries. I am not sure of the
  // strength of the indication. It might be a heuristic kind of like what
  // MS VIPS paper mentioned.

  // Remove one-dimensional images. Typically these are tracker images that
  // are a part of boilerplate.
  if(image.width === 1 || image.height === 1) {
    lucu.node.remove(image);
    return;
  }
};