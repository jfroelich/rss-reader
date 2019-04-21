import cssParseURL from '/src/lib/css-parse-url.js';

// Look for elements in the document that have a background image specified by a style attribute and
// no descendant foreground image. For such elements, remove the background image property from the
// style attribute and append a child foreground image with the same url.
//
// This currently takes a very simplified view of how an element's background image is specified.
// This assumes an element has only one background image specified. This assumes the image is not
// obscured. This assumes css properties are not inherited because getComputedStyle is unavailable
// since this assumes the document is inert. This assumes the background image is specified by the
// backgroundImage property and not the background property.
export default function filterDocument(document) {
  const elements = document.querySelectorAll('[style]');
  for (const element of elements) {
    if (element.style && element.style.backgroundImage && !element.querySelector('img')) {
      const url = cssParseURL(element.style.backgroundImage);
      if (url) {
        // Remove original style information from the parent
        element.style.backgroundImage = '';
        if (!element.style.length) {
          element.removeAttribute('style');
        }

        // Introduce a new child image element (arbitrarily as last element)
        const foregroundImage = document.createElement('img');
        foregroundImage.setAttribute('src', url);
        element.append(foregroundImage);
      }
    }
  }
}
