// TODO:see the comment in feature extraction on feature props

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
