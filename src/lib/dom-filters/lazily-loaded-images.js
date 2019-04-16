import * as imageUtils from '/src/lib/image-utils.js';

// Popular names of alternate image element attributes used for lazy-loading. This is not an
// exhaustive list. This list should be extended as needed.
const lazyAttributeNames = [
  'big-src', 'load-src', 'data-src', 'data-src-full16x9', 'data-src-large', 'data-original-desktop',
  'data-baseurl', 'data-flickity-lazyload', 'data-lazy', 'data-path', 'data-image-src',
  'data-original', 'data-adaptive-image', 'data-imgsrc', 'data-default-src', 'data-hi-res-src'
];

// Scans the document for image elements that are missing a conventional source url but contain a
// non-standard alternative attribute indicating the image's source url. For each qualifying image,
// the filter sets the image's source url to the alternative url and removes the alternative
// attribute.
//
// This filter ignores srcset descriptors. That is a concern of a different filter. Here, specifying
// an image's srcset attribute does not matter with regard to whether an image is considered lazy.
//
// This filter should occur before canonicalizing urls, because it may set attributes that need to
// be canonicalized that previously did not exist.
export default function transform(document) {
  const images = document.querySelectorAll('img');
  for (const image of images) {
    if (!imageUtils.imageHasSource(image)) {
      const attributeNames = image.getAttributeNames();
      for (const name of lazyAttributeNames) {
        if (attributeNames.includes(name)) {
          const value = image.getAttribute(name);
          if (isValidURLString(value)) {
            image.removeAttribute(name);
            image.setAttribute('src', value);
            break;
          }
        }
      }
    }
  }
}

// Very minimal validation, the value just has to "look like" a url
function isValidURLString(value) {
  return typeof value === 'string' && value.length > 1 && value.length <= 3000 &&
    !value.trim().includes(' ');
}
