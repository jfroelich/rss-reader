import {Block} from './block.js';

// Given a document, produce a dataset suitable for analysis
export function create_block_dataset(document, neutral_score) {
  if (!document.body) {
    return [];
  }

  // Distinguishable areas of content
  // NOTE: lists (ol/ul/dl) excluded at the moment due to bad scoring
  // NOTE: <code> excluded at the moment, maybe permanently

  const block_element_names = [
    'article', 'aside', 'blockquote', 'div', 'figure', 'footer', 'header',
    'layer', 'main', 'mainmenu', 'menu', 'nav', 'picture', 'pre', 'section',
    'table', 'td', 'tr'
  ];

  const elements = document.body.getElementsByTagName('*');
  const dataset = [];
  for (let element_index = 0, len = elements.length; element_index < len;
       element_index++) {
    const element = elements[element_index];
    if (block_element_names.includes(element.localName)) {
      const block = new Block(element, neutral_score, element_index);

      // TODO: this needs a comment describing what this does because it is not
      // obvious. It may even be better to encapsulate it in a helper function.
      for (let block_index = dataset.length - 1; block_index > -1;
           block_index--) {
        if (dataset[block_index].element.contains(element)) {
          block.parent_block_index = block_index;
          break;
        }
      }

      dataset.push(block);
    }
  }

  return dataset;
}
