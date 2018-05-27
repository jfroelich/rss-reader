import {coerce_element} from '/src/lib/dom/coerce-element.js';

// TODO: add console parameter
// TODO: add tests. Or at least state why test not needed
// TODO: rename element-coerce to coerce-element, I changed my mind again about
// naming convention, this todo belongs whereever its defined
// TODO: if this is the sole user of coerce it should probably be a private
// helper here? Part of larger goal of reducing number of libraries, and design
// goal of not creating separate libraries when there is only one call site. For
// example I just deleted the file lib because its one function,
// read-file-as-text, was only in use by import-opml. I did not do this
// immediately because the current commit is more concerned with separating out
// the function into its own lib, and this is a separate concern.
// TODO: make this more exhaustive. There may be other obvious savings that are
// low hanging fruit. For now I implemented a couple off the top of my head.

// Replace certain elements with alternative elements that have names with
// fewer characters. This helps reduce the number of characters in the document
// content when serialized. It also normalizes tags by basically choosing that
// among the several ways to make something bold there is only one right way,
// and presumes that the one right way is whatever way involves the least amount
// of characters.
//
// The tradeoff for saving space is obviously time. Fortunately this filter is
// relatively lightweight.
//
// Despite this normalization benefit, other filters should not rely on this
// behavior. For example, a filter that examines emphasis should still consider
// all variations of expression. The primary purpose of this filter is a
// reduction in disk space, not normalization. The primary purpose will never
// change in the future but this normalization side effect could change, so it
// is wrong to rely on it. Normalization is not contractually warranted.
//
// Throws an error if document is not a document.
//
// @param copy_attrs_flag {Boolean} optional, if true then copy attributes
export function condense_tagnames(document, copy_attrs_flag) {
  // Analysis is restricted to body.
  if (!document.body) {
    return;
  }

  // This could be instead implemented as a loop over a map. However, I decided
  // not to do that because I am concerned about extensibility. There may be
  // some abnormal transforms that need to be applied to other elements. Also,
  // because it is just two elements at the moment, and so an unrolled loop is
  // probably faster. I suppose I could go back to a helper function? The
  // function got lost in a series of refactoring where I moved it to a utils
  // lib.

  // Even though b and i have been somewhat shunned, browsers still support
  // them. It might be interesting to read about the rationale behind why
  // they added <strong> when <b> sufficed.

  // Note that this uses querySelectorAll over getElementsByTagName because of
  // how much simpler it is to iterate forward over the collection and perform
  // mutations during iteration. I get to use for-of, which is terse and
  // convenient. coerce_element implicitly does things like remove and create
  // elements in the dom tree, and this totally screws up the 'static' nature of
  // getElementsByTagName. I am not even sure if querySelectorAll is much slower
  // than getElementsByTagName because the relative performance of each seems to
  // change in every browser version increment.

  // strong => b
  const strong_elements = document.body.querySelectorAll('strong');
  for (const element of strong_elements) {
    coerce_element(element, 'b', copy_attrs_flag);
  }

  // em => i
  const em_elements = document.body.querySelectorAll('em');
  for (const element of em_elements) {
    coerce_element(element, 'i', copy_attrs_flag);
  }
}
