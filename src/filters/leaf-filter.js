
'use strict';

// Dependencies:
// assert.js
// element.js

/*

# TODO: improve leaf filtering performance

Figure out a way to avoid re-trimming text nodes. I feel like the bulk of the time is spent doing this. I need to measure first.

Because DOM modification is expensive, this tries to minimize the number of elements removed by only removing the shallowest elements. For example, when processing , the naive approach would perform two operations, first removing the innerleaf and then the outerleaf. The outerleaf is also a leaf because upon removing the innerleaf, it then satisfies the is-leaf condition. Instead, this recognizes this situation, and only removes outerleaf. The cost of doing this is that the is-leaf function is recursive and nested elements are revisited.

This still iterates over all of the elements, because using querySelectorAll is faster than walking. As a result, this also checks at each step of the iteration whether the current element is still attached to the document, and avoids removing elements that were detached by virtue of an ancestor being detached in a prior iteration step.

Only iterate elements within the body element. This prevents the body element itself and the document element from also being iterated and therefore identified as leaves and therefore removed in the case of an empty document.

doc_element.contains(doc_element) returns true because doc_element is an inclusive descendant of doc_element as defined in the spec. This is why doc_element itself can also be removed if this iterated over all elements and not just those within the body.

contains is checked first because it is a native method that is faster than is_leaf_node, so this minimizes the calls to is_leaf_node

This is not currently using for..of to iterate over the node list because of a V8 deoptimization warning (something about a try catch), my guess is that it has to do with how it is desugared

Think of a better way to avoid revisiting nodes


# TODO: improve criteria for leaf filtering

Do not always filter empty table cells. Cells in some cases are important to
the structure of the table even if empty.

But if I implement this in isLeaf, be wary of the fact that the single column
table transformation also does leaf checking and does want to know if a cell is
empty.

Therefore, probably need to a parameter to is leaf that determines whether or
not an empty cell should be considered a leaf.
*/

function leaf_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  const doc_element = doc.documentElement;

  const elements = doc.body.querySelectorAll('*');
  for(const element of elements) {
    if(doc_element.contains(element) && node_is_leaf(element))
      element.remove();
  }

}
