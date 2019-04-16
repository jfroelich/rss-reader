import * as srcsetUtils from '/src/lib/srcset-utils.js';

// TODO: somehow also do the srcset resolution in the first pass, e.g. store * as value in
// elementAttributeMap and that means it is special handling

// A mapping between names of elements and names of attributes that have urls
const elementAttributeMap = {
  a: 'href',
  applet: 'codebase',
  area: 'href',
  audio: 'src',
  base: 'href',
  blockquote: 'cite',
  body: 'background',
  button: 'formaction',
  del: 'cite',
  embed: 'src',
  frame: 'src',
  head: 'profile',
  html: 'manifest',
  iframe: 'src',
  form: 'action',
  img: 'src',
  input: 'src',
  ins: 'cite',
  link: 'href',
  'model-viewer': 'src',
  object: 'data',
  q: 'cite',
  script: 'src',
  source: 'src',
  track: 'src',
  video: 'src'
};

// Resolves all element attribute values that contain urls in |document|.
// Assumes the document has a valid base uri.
export default function filter(document) {
  const baseURL = new URL(document.baseURI);

  // In the first pass, select all mapped elements present anywhere in the
  // document, and resolve attribute values per element
  const keys = Object.keys(elementAttributeMap);
  const selector = keys.map(key => `${key}[${elementAttributeMap[key]}]`).join(',');
  const elements = document.querySelectorAll(selector);

  for (const element of elements) {
    const attributeName = elementAttributeMap[element.localName];
    if (attributeName) {
      const attributeValue = element.getAttribute(attributeName);
      if (attributeValue) {
        try {
          const url = new URL(attributeValue, baseURL);
          if (url.href !== attributeValue) {
            element.setAttribute(attributeName, url.href);
          }
        } catch (error) {
          // Ignore
        }
      }
    }
  }

  // In the second pass, resolve srcset attributes
  const srcsetSelector = 'img[srcset], source[srcset]';
  const srcsetElements = document.querySelectorAll(srcsetSelector);
  for (const element of srcsetElements) {
    const descriptors = srcsetUtils.parse(element.getAttribute('srcset'));

    let changeCount = 0;
    for (const desc of descriptors) {
      try {
        const url = new URL(desc.url, baseURL);
        if (url.href.length !== desc.url.length) {
          desc.url = url.href;
          changeCount += 1;
        }
      } catch (error) {
        // Ignore
      }
    }

    if (changeCount) {
      const newValue = srcsetUtils.serialize(descriptors);
      if (newValue) {
        element.setAttribute('srcset', newValue);
      }
    }
  }
}
