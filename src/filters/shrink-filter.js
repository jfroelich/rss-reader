'use strict';

// TODO: finish breaking apart into component filters then deprecate
// TODO: do not forget to also move comments

(function(exports) {

function shrink_filter(doc) {

  const body_element = doc.body;
  if(!body_element)
    return;

  // TODO: create condense-names-filter.js
  // Use shorter names for common elements
  // Because we are stripping attributes, there is no need to keep them
  const copy_attrs_on_rename = false;
  rename_elements(body_element, 'strong', 'b', copy_attrs_on_rename);
  rename_elements(body_element, 'em', 'i', copy_attrs_on_rename);




  unwrap_captionless_figure_elements(body_element);

  // Unwrap semantic container sections
  unwrap_elements(body_element,
    'article, aside, footer, header, main, section');
  // Unwrap table sections
  unwrap_elements(body_element,
    'colgroup, hgroup, multicol, tbody, tfoot, thead');
  // Unwrap generic containers
  unwrap_elements(body_element, 'div, ilayer, layer');


  remove_leaf_nodes(body_element);
}

// Unwrap figure elements that merely wrap an image without adding a caption
function unwrap_captionless_figure_elements(ancestor_element) {
  if(ancestor_element) {
    const figure_elements = ancestor_element.querySelectorAll('figure');
    for(const figure_element of figure_elements)
      if(figure_element.childElementCount === 1)
        unwrap_element(figure_element);
  }
}

function remove_leaf_nodes(ancestor_element) {
  if(ancestor_element) {
    const doc_element = ancestor_element.ownerDocument.documentElement;
    const elements = ancestor_element.querySelectorAll('*');
    for(const element of elements)
      if(doc_element.contains(element) && node_is_leaf(element))
        element.remove();
  }
}


exports.shrink_filter = shrink_filter;

}(this));


/*

# TODO
* Replace entities with single unicode character where possible in order
to shrink document size? Part of the challenge is how to get entities when
node.nodeValue auto encodes
* Are there other elements with abbreviated versions like strong/em?

* Remove processing instructions and doc type stuff
* Can shrink some attribute values, like for image width change 100px to 100,
because units are implied in many places
* Can reduce the size of attribute values by trimming them
* Can remove attributes that do not have values that are non-unary attributes
* Can remove attributes that equal the default values
* Preprocess all entities like nbsp, and convert each one into its numeric
equivalent. On average the numeric entities use fewer characters. And possibly
go further given that it is utf8 encoding, do things like convert copy into
actual copyright utf character. Also consider the option to use whichever has
fewer characters, the named encoding or the numeric encoding. Also consider
working with a TextEncoder/Decoder api if appropriate. Also see https://github.com/mathiasbynens/he for ideas. Also, there is an issue with
the fact that condense takes a document but this would be maybe be easier on
raw text? See also https://github.com/kangax/html-minifier with its option
to use unicode char when possible
* If an image is a known square with equal attribute values, can maybe remove
one of the dimensions?
* actually, just take a look at https://github.com/kangax/html-minifier and
think about some similar options
* entity to single utf8 char filter

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
