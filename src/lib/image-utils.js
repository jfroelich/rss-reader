import unwrapElement from '/src/lib/unwrap-element.js';

// Returns true if the image element has at least one source
export function imageHasSource(image) {
  if (hasAttributeValue(image, 'src') || hasAttributeValue(image, 'srcset')) {
    return true;
  }

  const picture = image.closest('picture');
  if (picture) {
    const sources = picture.getElementsByTagName('source');
    for (const source of sources) {
      if (hasAttributeValue(source, 'src') || hasAttributeValue(source, 'srcset')) {
        return true;
      }
    }
  }

  return false;
}

function hasAttributeValue(element, attributeName) {
  const value = element.getAttribute(attributeName);
  return !!((value && value.trim()));
}

// Detach an image along with some of its dependencies
export function removeImage(image) {
  if (!image.parentNode) {
    return;
  }

  const figure = image.parentNode.closest('figure');
  if (figure) {
    const captions = figure.querySelectorAll('figcaption');
    for (const caption of captions) {
      caption.remove();
    }

    unwrapElement(figure);
  }

  const picture = image.parentNode.closest('picture');
  if (picture) {
    const sources = picture.querySelectorAll('source');
    for (const source of sources) {
      source.remove();
    }

    unwrapElement(picture);
  }

  image.remove();
}
