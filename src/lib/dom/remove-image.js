import {element_unwrap} from '/src/lib/dom/element-unwrap.js';

// The remove function detaches an image element from its containing document,
// and in addition, possibly affects other elements that lose purpose as a
// result of removing the image.

// TODO: cleanup comments, be more concise

// TODO: better ripple effects handling. This ties into knowledge of how a
// document is modified by all filters. Several filters leave the document in a
// variety of states without consideration of other filters. For example, if we
// remove an image, and even if we remove figure/picture, then there is still
// the possibility that this then results in a leaf node, such as a parent `div`
// that is basically empty. In other words the ripple effects are recursive,
// which changes the perspective of what remove is doing, and in hindsight makes
// it rather naive and questionable whether it is worth it to even attempt to
// consider any ripple effects at all.

// TODO: Perhaps it would be better if, rather than removing, there was more of
// a mark-sweep approach, where images and associated elements were marked for
// removal rather than actually removed. This would allow for multiple reasons
// for marking. But it would leave junk in there that other filters would have
// to consider.

// TODO: A similar concern is, for example, hidden elements. There is no point
// to processing hidden elements because those are also removed. This naively
// goes and considers picture/figure that may be hidden. So the work is
// redundant because the concerns are separated. The joint concern is basically
// removal. Which suggests the functional purpose should not be oriented based
// on whether we are removing an image or some other kind of element, but
// instead the action of removal of any content in a document. Something like a
// 'dom-removal' API, of which handling images and associated elements for
// various reasons is just one concern. One of the reasons I have not really
// solved it is that the solution ties into the entire design of the content
// filters as a series of separate passes with separate concerns. The problem is
// in the approach itself.

export function remove_image(image) {
  // The initial check for whether the image has a parent node is admittedly
  // partially redundant with some of the work done later in the function. It is
  // ok to call remove on an element without a parent (an orphan), it is a
  // no-op. However, checking for the parent provides a couple of benefits.
  // First, it avoids the error that would otherwise occur when calling
  // image.parentNode.closest (or rather, the error becomes explicit). Second,
  // the check can avoid a substantial amount of processing. If the image
  // element does not have a parent then that means it is an orphaned element
  // that was previously removed, or was never attached. There is no apparent
  // value in removing an orphaned image.
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

    element_unwrap(figure);
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

    element_unwrap(picture);
  }

  image.remove();
}
