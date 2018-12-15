// TODO: none of the features should be build it, things like text_length and
// line count and all of that.

// TODO: score should not be a built in property. a block is only concerned with
// representing the parsed featured of a block, not its derived features,
// whether those derived features are variables for later heuristics or the
// final classification. this also means that initial score should not be a
// parameter.

// A block is a representation of a portion of a document's content along with
// some derived properties.
//
// @param element {Element} a live reference to the element in a document that
// this block represents
// @param element_index {Number} the index of the block in the all-body-elements
// array
export function Block(element, initial_score = 0, element_index = -1) {
  this.element = element;
  this.element_index = element_index;
  this.parent_block_index = -1;
  this.element_type = undefined;
  this.depth = -1;
  this.text_length = -1;
  this.line_count = 0;
  this.image_area = 0;
  this.list_item_count = 0;
  this.paragraph_count = 0;
  this.field_count = 0;
  this.attribute_tokens = [];

  this.score = initial_score;
}
