
# About

Helpers for sanitizing the contents of an HTMLDocument

# TODO

* Create sanitize-html-document.js, move relevant code there out of scrubby
* Create condense-html-document.hs, move relevant code there out of scrubby
* Create secure-html-document.js, move relevant code there out of scrubby

* Replace strong with b to shrink document size
* Replace em with i to shrink document size
* Replace entities with single unicode character where possible in order
to shrink document size?
* Fix things like <b><table></table></b>, see https://html.spec.whatwg.org/multipage/parsing.html mentions of adoption
algorithm and its errata notes

* filterAttributes needs cleanup, add helper functions
* For isSingleColumnRow, check if row.cells supports for..of
* For unwrapSingleColumnTable, check if table.rows supports for..of
* For unwrapSingleColumnTable, only pad if adjacent to text

* Ensure that the ping attribute of anchors is removed. Probably just do this
explicitly even if it is redundant.
* simarly probably move the add-no-ref and such to some other lib that deals
with DNT code
