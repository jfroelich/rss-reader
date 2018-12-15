import {Block} from './block.js';

// Blocks are distinguishable areas of content
// NOTE: lists (ol/ul/dl) excluded at the moment due to bad scoring
// TODO: i need to somehow reintroduce support for treating lists as
// distinguishable blocks. For example, <ul old-id="breadcrumbs"></ul> is a
// standalone section of content that should be removable
// NOTE: <code> excluded at the moment, maybe permanently

// TODO: I would prefer that neutral_score not be a parameter. but right now
// it is needed to properly initialize blocks. so i need to change block
// constructor first then remove it here.


// Given a document, produce an array of blocks
export function parse_blocks(document, neutral_score) {
  if (!document.body) {
    return [];
  }

  const block_element_names = [
    'article', 'aside', 'blockquote', 'div', 'figure', 'footer', 'header',
    'layer', 'main', 'mainmenu', 'menu', 'nav', 'picture', 'pre', 'section',
    'table', 'td', 'tr'
  ];

  // NOTE: while it is tempting to use a selector that traverses only those
  // elements that are block candidates, this would deny us from tracking the
  // proper index into a collection of all dom elements. We need to track the
  // all-elements index so that we can find which element corresponds to which
  // block later (if and once I remove the element property from a block).

  const elements = document.body.getElementsByTagName('*');
  const blocks = [];
  for (let element_index = 0, len = elements.length; element_index < len;
       element_index++) {
    const element = elements[element_index];
    if (block_element_names.includes(element.localName)) {
      const block = new Block(element, neutral_score, element_index);
      find_and_set_parent(blocks, block, element);
      blocks.push(block);
    }
  }

  return blocks;
}

// TODO: this should be composable, like find-parent + set-parent-prop, not this
// compound verb
function find_and_set_parent(blocks, block, element) {
  // We walk backwards because the parent is most likely to be the preceding
  // block (the last block in the array) at the time this is called.

  for (let index = blocks.length - 1; index > -1; index--) {
    if (blocks[index].element.contains(element)) {
      block.parent_block_index = index;
      break;
    }
  }
}
