// image filtering lib

'use strict';

// Dependencies:
// assert.js

// TODO: removing sourceless images should maybe take into account parent
// picture tag if present.
function sourcless_image_filter(doc) {

  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  const images = doc.body.querySelectorAll('img');
  for(const image of images) {
    if(sourcless_image_filter_is_sourceless(image)) {
      sourcless_image_filter_remove(image);
    }
  }
}

// TODO: move to image.js? is there a function already like this is
// image.js?
// TODO: invert condition, rename to _has_source?
// TODO: consider picture associated source
function sourcless_image_filter_is_sourceless(image) {
  return !image.hasAttribute('src') && !image.hasAttribute('srcset');
}

// TODO: remove picture/figcaption/figure

/*
In fact any removal of image anywhere should
also take into account figcaption, figure, picture, maybe even call out
to helper image_remove_with_baggage

make an image_remove helper function in image.js that deals with it all
look at other areas in code that do image pruning, have them call out to
the helper.

make a github issue with task about reviewing naive removal of any element from
dom to consider its consequences and whether other ripple effects should also
be considered
*/

function sourcless_image_filter_remove(image) {
  image.remove();
}
