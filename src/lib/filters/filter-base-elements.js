// TODO: actually, this should be done only after canonicalizing urls, and
// the canonicalizer should consider base elements. By doing it after and
// having canon consider it, then we support base element more properly
// Actually it should be merged into the end of canonical. Instead, what
// should happen here is an insertion of the document-url as a new base
// element, if another base element does not exist, so as to have the
// desired side effect of mutating the otherwise immutable
// document.baseURI. In fact it should probably be a filter like
// set_base_uri(document, document_url). And, in fact, it maybe should not
// even be a filter, but a concern of the caller, and transform-document's
// input requirements should adapt to assume every element's href-like
// getter or whatever will yield a canonical url.

export function filter_base_elements(document) {
  const bases = document.querySelectorAll('base');
  for (const base of bases) {
    base.remove();
  }
}
