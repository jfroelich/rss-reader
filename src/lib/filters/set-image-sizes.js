import {fetch_policy} from '/src/fetch-policy.js';
import {fetch_image_element} from '/src/lib/net/fetch-image-element.js';


// TODO: do not assume that if an image has a source attribute that it is a
// valid url. urls may not have been validated by other filters. This has to
// operate independently of those filters.

// TODO: now that this expects document to have document.baseURI set, I can
// work directly from image.src, instead of image.getAttribute('src')

// TODO: re-introduce console parameter

// Scans the images of a document and ensures the width and height attributes
// are set. If images are missing dimensions then this fetches the dimensions
// and modifies each image element's attributes.
// Assumes that if an image has a src attribute value that is a url, that the
// url is absolute.
export async function set_image_sizes(document, timeout) {
  if (!document.body) {
    return;
  }

  if (!document.baseURI) {
    throw new TypeError('document missing baseURI');
  }

  const document_url = new URL(document.baseURI);


  const images = document.body.getElementsByTagName('img');
  if (!images.length) {
    return;
  }

  // Concurrently get dimensions for each image then wait for all to complete
  const promises = [];
  for (const image of images) {
    promises.push(get_image_dims(image, document_url, timeout));
  }
  const results = await Promise.all(promises);

  // Update the DOM for images that need state change
  for (const result of results) {
    if ('width' in result) {
      result.image.setAttribute('width', result.width);
      result.image.setAttribute('height', result.height);
    }
  }
}

async function get_image_dims(image, base_url, timeout) {
  if (image.hasAttribute('width') && image.hasAttribute('height')) {
    return {image: image, reason: 'has-attributes'};
  }

  let dims = get_style_dims(image);
  if (dims) {
    return {
      image: image,
      reason: 'inline-style',
      width: dims.width,
      height: dims.height
    };
  }

  const image_source = image.getAttribute('src');
  if (!image_source) {
    return {image: image, reason: 'missing-src'};
  }

  // Parsing the url can throw an error. get_image_dims should not throw
  // except in the case of a programming error.
  let source_url;
  try {
    source_url = new URL(image_source, base_url);
  } catch (error) {
    // If we cannot parse the url, then we cannot reliably inspect
    // the url for dimensions, nor fetch the image, so we're done.
    return {image: image, reason: 'invalid-src'};
  }

  dims = get_url_dims(source_url);
  if (dims) {
    return {
      image: image,
      reason: 'url-sniff',
      width: dims.width,
      height: dims.height
    };
  }

  // Failure to fetch should be trapped, because get_image_dims should
  // only throw in case of a programming error, so that it can be used together
  // with Promise.all
  try {
    dims = await fetch_image_element(source_url, timeout, fetch_policy);
  } catch (error) {
    return {image: image, reason: 'fetch-error'};
  }

  return {
    image: image,
    reason: 'fetch',
    width: dims.width,
    height: dims.height
  };
}

// Try and find image dimensions from the characters of its url
function get_url_dims(source_url) {
  // Ignore data urls (will be handled later by fetching)
  if (source_url.protocol === 'data:') {
    return;
  }

  const named_attr_pairs =
      [{width: 'w', height: 'h'}, {width: 'width', height: 'height'}];

  // Infer from url parameters
  const params = source_url.searchParams;
  for (const pair of named_attr_pairs) {
    const width_string = params.get(pair.width);
    if (width_string) {
      const width_int = parseInt(width_string, 10);
      if (!isNaN(width_int)) {
        const height_string = params.get(pair.height);
        if (height_string) {
          const height_int = parseInt(height_string, 10);
          if (!isNaN(height_int)) {
            const dimensions = {};
            dimensions.width = width_int;
            dimensions.height = height_int;
            return dimensions;
          }
        }
      }
    }
  }
}

function get_style_dims(element) {
  if (element.hasAttribute('style') && element.style) {
    const width = parseInt(element.style.width, 10);
    if (!isNaN(width)) {
      const height = parseInt(element.style.height, 10);
      if (!isNaN(height)) {
        return {width: width, height: height};
      }
    }
  }
}
