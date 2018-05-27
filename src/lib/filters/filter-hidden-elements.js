import {element_is_hidden_inline} from '/src/lib/dom/element-is-hidden-inline.js';
import {unwrap_element} from '/src/lib/dom/unwrap-element.js';
import {color_contrast_filter} from '/src/lib/filters/color-contrast-filter.js';

// Removes hidden elements from a document. This filter is impure in that it
// mutates the input document due to the prohibitive cost of cloning.
// @param document {Document} the document to filter. Assumes the document is
// implicitly html-flagged and not xml-flagged.
// @param matte {color} see color contrast filter docs
// @param mcr {number} see color contrast filter docs
// @error {Error} if document is undefined or not a document
// @return {void}

// TODO: reintroduce console parameter as a part of the general redesign of
// having all filters do some optional logging

export function filter_hidden_elements(document, matte, mcr) {
  // Assume this works because the document is implicitly html-flagged and not
  // xml-flagged. This is naively preferred to querySelector for terseness and
  // speed.
  const body = document.body;

  // Ignore elements outside of body. Elements outside of body are assumed to
  // be hidden or otherwise properly ignored by later consumers of a document's
  // content. If there is no body, then this is a no-op and we are done.
  // The document is not guaranteed to have a body.
  if (!body) {
    return;
  }

  // Iterate over all elements, checking each element individually if it is
  // hidden. If an element is hidden it is 'removed'.

  // Rather than some manual walk of the dom tree, which seems like it would be
  // fast because it avoids traversing hidden branches, benchmarking
  // demonstrates that it is substantially faster to iterate over all elements
  // and checking per visit whether an element is still present in the tree. I
  // think that the basic reason for this is that querySelectorAll and
  // document.contains are both highly optimized, and because more processing
  // occurs natively. At one point this did a walk, unfortunately I've lost
  // sight of that old implementation. It would have been nice to keep around
  // for benchmarking.
  // TODO: reintroduce benchmarks that prove this statement, or link to an
  // authoritative resource.

  // This uses querySelectorAll over getElementsByTagName because it greatly
  // simplifies the task of removing elements during iteration, and allows the
  // use of for..of.

  // TODO: so now i remember the original issue regarding why this does unwrap
  // instead of remove. the problem is with documents that use progressive
  // reveal techniques. such documents use a common technique where a document's
  // content is initially hidden, and then later made visible by script once
  // the document is loaded. in one of the earliest implementations of this
  // filter, i did removal. this lead to the issue of seeing empty documents in
  // the view that should not be empty. in other words the filter caused the
  // app's view to stop correctly mimicing the actual browsing experience. i
  // would like to revisit this. i think this decision is unfortunately the main
  // reason that i see a ton of junk content appearing in the view. perhaps i
  // could use a whitelist approach. whitelist sites that use the revealing
  // technique, check origin here, if whitelisted then unwrap, otherwise remove.
  // this is obviously not the best solution but perhaps it is better than now?
  // the problem is kind of boilerplate filtering issue. maybe it really is
  // functionality that should be a subset of the boilerplate algorithm, and
  // distinguishing this filter from the boilerplate filter was a mistake (back
  // when everything was all one monolithic pass).

  const elements = body.querySelectorAll('*');
  for (const element of elements) {
    if (body.contains(element) && element_is_hidden_inline(element)) {
      unwrap_element(element);
    }
  }

  // NOTE: initially the contrast filter was done separately, but I then made
  // the design decision to strongly couple the the contrast filter with this
  // filter. both have the same objective of removing hidden elements. it makes
  // sense to co-locate them (have one occur right after the other). having
  // low-contrast is just another example of being hidden.

  // This color contrast filtering is done in a second pass, largely because it
  // was initially implemented in separate modules and the caller had to call
  // both this filter and the color contrast filter independently. I don't think
  // the perf cost of that decision is too harmful. I might want to revisit
  // this and rewrite the code as if I had originally written both together.

  // NOTE: reminding myself. i am tempted to directly access config here
  // instead of having values get piped in via params. but that would be wrong.
  // this is a lib. config.js is not supposed to be available to libs.

  // TODO: I could consider inlining the function here now? Or at least moving
  // the function's definition here, because it does not need to standalone. I
  // think this is the sole caller? other than some tests? I could make it a
  // helper here and a second export. then again also take a look at the todos
  // in the contrast filter, i had some thoughts about the granularity of the
  // abstraction, it may be wrong in the first place. the decision of whether
  // to inline it all here should probably happen after i make those other
  // decisions.

  color_contrast_filter(document, matte, mcr);
}
