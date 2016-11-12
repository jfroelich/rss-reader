// See license.md

'use strict';

class DocumentLayout {
  // Scans the images of a document and ensures the width and height attributes
  // are set. If images are missing dimensions then this fetches the dimensions
  // and modifies each image element's attributes.
  // @param doc {Document}
  // @param timeout {Number} optional, if not set or 0 then no timeout
  // @returns {Number} the number of images modified
  static async setDocumentImageDimensions(doc, timeout = 0) {
    if(!Number.isInteger(timeout) || timeout < 0)
      throw new TypeError(`Invalid timeout ${timeout}`);
    const images = doc.getElementsByTagName('img');
    const proms = Array.prototype.map.call(images,
      (image) => this.getImageDimensions(image, timeout));
    let results = await Promise.all(proms);
    results = results.filter((r) => r);
    for(let {image, w, h} of results) {
      image.setAttribute('width', w);
      image.setAttribute('height', h);
    }
    return results.length;
  }

  // Retrieves the dimensions for a given image object
  // @param image {HTMLImageElement}
  // @param timeout {Number}
  static async getImageDimensions(image, timeout) {

    // Even though this could be done synchronously and externally, this
    // lets delays in attribute lookup not block each other (in theory).
    // Perf testing shows that getAttribute and hasAttribute are very slow.
    if(image.hasAttribute('width') && image.hasAttribute('height'))
      return;

    // Infer from inline style. Because the assumption is that the input doc
    // was inert, there is no guarantee that the style props initialized the
    // width and height properties, and we know that style wasn't computed
    // after resolution of external style sheets
    if(image.hasAttribute('style') && image.style.width && image.style.height)
      return {'image': image, 'w': image.style.width,'h': image.style.height};

    // Even though sourceless images are filtered elsewhere, this cannot make
    // any assumptions about that. So this is redundant for the sake of
    // independence.
    const src = image.getAttribute('src');
    if(!src)
      return;

    // If the url is invalid there is no point in fetching. This also gives us
    // access to normalized protocol value.
    let url;
    try {
      url = new URL(src);
    } catch(error) {
      return;
    }

    // We should only try to fetch these protocols
    if(url.protocol !== 'http:' && url.protocol !== 'https:')
      return;

    // Race a timeout against a fetch attempt
    const promises = [this.fetchImage(url.href)];
    if(timeout)
      promises.push(this.fetchImageTimeout(timeout));

    let proxy;
    try {
      proxy = await Promise.race(promises);
      return {'image': image, 'w': proxy.width, 'h': proxy.height};
    } catch(error) {
      // console.warn(url.href, error);
    }
  }

  // Rejects with a time out error after a given number of ms
  static fetchImageTimeout(timeout) {
    return new Promise((resolve, reject) =>
      setTimeout(reject, timeout, new Error('Timed out')));
  }

  // Fetch an image element.
  // TODO: Does a normal image request include cookie header?
  // @param url {String} an image url
  static fetchImage(url) {
    return new Promise((resolve, reject) => {
      // Create proxy image in document running this script
      const image = new Image();
      // Trigger the fetch
      image.src = url;
      // Resolve immediately if cached
      if(image.complete)
        return resolve(image);
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image ${url}`));
    });
  }
}
