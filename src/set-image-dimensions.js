// See license.md

'use strict';

// TODO: change to promise
// TODO: change to async


{

function set_image_dimensions(doc, log, callback) {
  // TODO: log baseURI
  log.log('Setting image dimensions for document');
  const ctx = {
    'num_processed': 0,
    'num_fetched': 0,
    'num_modified': 0,
    'num_imgs': 0,
    'callback': callback,
    'doc': doc,
    'did_callback': false,
    'log': log
  };
  const images = doc.getElementsByTagName('img');
  if(!images.length) {
    on_complete.call(ctx);
    return;
  }

  ctx.num_imgs = images.length;
  for(let image of images) {
    process_img.call(ctx, image);
  }
}

function process_img(image) {
  if(image.getAttribute('width') || image.getAttribute('height'))
    return on_processed.call(this);

  if(infer_from_style(image)) {
    this.num_modified++;
    return on_processed.call(this);
  }

  const src = image.getAttribute('src');
  if(!src)
    return on_processed.call(this);
  const src_url = parse_url_no_raise(src);
  if(!src_url)
    return on_processed.call(this);
  if(src_url.protocol !== 'http:' && src_url.protocol !== 'https:')
    return on_processed.call(this);

  // Calling new Image creates the image in the current document context,
  // which is different than the document containing the image. The current
  // context is live, and will eagerly fetch images when the src property is
  // set. The document containing the image is inert, so setting its src would
  // not have an effect.
  const proxy = new Image();
  proxy.src = src;

  // If completed (cached) then use the available dimensions
  if(proxy.complete) {
    this.num_modified++;
    image.setAttribute('width', proxy.width);
    image.setAttribute('height', proxy.height);
    return on_processed.call(this);
  }

  // If incomplete then listen for response
  proxy.onload = on_load.bind(this, image);
  proxy.onerror = on_error.bind(this, image);
}

function on_error(image, event) {
  this.num_fetched++;
  on_processed.call(this);
}

function on_load(image, event) {
  this.num_fetched++;
  image.setAttribute('width', event.target.width);
  image.setAttribute('height', event.target.height);
  this.num_modified++;
  on_processed.call(this);
}

function on_processed() {
  // This increment should only happen here, because this should only happen
  // once each call completes, which is sometimes asynchronous.
  this.num_processed++;
  if(this.num_processed === this.num_imgs) {
    on_complete.call(this);
  }
}

function on_complete() {
  // remnant of a fixed bug, left as reminder
  if(this.did_callback)
    throw new Error();
  this.did_callback = true;
  this.callback(this.num_modified);
}

// Check if the dimensions are available from an inline style attribute
// This will trigger style computation, which is pretty damn slow, but that
// shouldn't matter too much given that this is async. Note that accessing
// the style property only looks at the inline style, as desired, which is
// different than getComputedStyle, which looks at the inherited properties
// too. Also note that image.style.width yields a string, such as "100%" or
// "50px", and this is the value set for the attribute.
function infer_from_style(image) {
  let dirtied = false;
  if(image.hasAttribute('style')) {
    if(image.style.width) {
      image.setAttribute('width', image.style.width);
      dirtied = true;
    }
    if(image.style.height) {
      image.setAttribute('height', image.style.height);
      dirtied = true;
    }
  }
  return dirtied;
}

function parse_url_no_raise(url_str) {
  let url_obj = null;
  try { url_obj = new URL(url_str); } catch(error) {}
  return url_obj;
}

this.set_image_dimensions = set_image_dimensions;

}
