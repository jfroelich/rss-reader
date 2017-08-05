
# TODO

* Replace entities with single unicode character where possible in order
to shrink document size? Part of the challenge is how to get entities when
node.nodeValue auto encodes
* Are there other elements with abbreviated versions like strong/em?
* For isSingleColumnRow, check if row.cells supports for..of
* For unwrapSingleColumnTable, check if table.rows supports for..of
* For unwrapSingleColumnTable, only pad if adjacent to text
* Remove processing instructions and doc type stuff
