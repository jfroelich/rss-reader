import * as image_element_utils from '/src/base/image-element-utils.js';

// Removes dead images from the document. An image is 'dead' if it is
// unfetchable. One reason that an image is unfetchable is when an image does
// not have an associated source. Note this does not actually test if the image
// is fetchable, this only examines whether the image looks unfetchable based
// on its html.
//
// A future implementation might consider fetching. But there are some problems
// with that at the moment considering the overlap between this filter and the
// filter that sets the width and height of images when the dimensions are
// missing, and lack of clarity regarding browser caching of image requests,
// and in particular, concurrent image requests.
export function image_dead_filter(document) {
  if (document.body) {
    const images = document.body.querySelectorAll('img');
    for (const image of images) {
      if (!image_element_utils.image_has_source(image)) {
        image_element_utils.remove_image(image);
      }
    }
  }
}
