import {unwrap_element} from '/src/dom/unwrap-element.js';

// The remove function detaches an image element from its containing document,
// and in addition, possibly affects other elements that lose purpose as a
// result of removing the image.
export function remove_image(image) {
  // The initial check for whether the image has a parent node is redundant with
  // some of the work done later. In addition, it is ok to call remove on an
  // element without a parent (an orphan), it is an implicit no-op.
  //
  // However, checking for the parent provides a couple of benefits.
  // First, it avoids the error that would otherwise occur when calling
  // image.parentNode.closest. Second, the check can avoid a sufficient amount
  // of processing to justify it. If the image element does not have a parent
  // then that means it is an orphaned element that was previously removed, or
  // was never attached. There is no apparent value in removing an orphaned
  // image.
  if (!image.parentNode) {
    return;
  }

  // Why querySelectorAll over getElementsByTagName when iterating figures or
  // pictures
  // * Unclear if faster or slower
  // * The performance delta may be marginal anyway, unclear.
  // * The result is live, so there is no issue with removing elements during
  // iteration when iterating forward (technically we could do live mutation
  // when using getElementsByTagName but would have to iterate backward).

  // Why call closest on the parent element instead of the image
  // The reason that this calls `closest` on the image's parent element rather
  // than the image itself, despite that calling closest on the image is terser
  // and would suffice, is because `closest` tests against itself in addition to
  // its ancestors. In other words the test is self-inclusive. Furthermore, we
  // know that image is an HTMLImageElement that `closest` will not match.
  // Therefore, we can reduce the work done by `closest` by calling `closest` on
  // the parent element. Note that I never actually tested whether this calling
  // from the parent node improves performance. It may even hurt performance,
  // and is something I would eventually like to test. It is notably marginal
  // and really should not be concerning. This explanation exists primarily to
  // explain the non-obviousness.

  // Why figures and pictures are unwrapped instead of removed
  // While it is tempting to simply remove the figure element itself and thereby
  // indirectly remove the image, this would risk data loss. The figure may be
  // used as a general container and contain content not related to the image.
  // The only content we know for certain that is related to the image in this
  // case is the caption. There should only be one, but this cannot assume
  // well-formedness, so remove any captions.

  const figure = image.parentNode.closest('figure');
  if (figure) {
    const captions = figure.querySelectorAll('figcaption');
    for (const caption of captions) {
      caption.remove();
    }

    unwrap_element(figure);
  }

  // Similar to figure, picture may be used as general container, so unwrap
  // rather than remove. The only thing we know that can be removed are the
  // source elements.
  const picture = image.parentNode.closest('picture');
  if (picture) {
    const sources = picture.querySelectorAll('source');
    for (const source of sources) {
      source.remove();
    }

    unwrap_element(picture);
  }

  image.remove();
}
