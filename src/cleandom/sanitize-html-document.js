// See license.md
'use strict';

{ // Begin file block scope

function sanitize_html_document(doc, verbose) {

  // Remove misc elements, generally style elements
  const misc_selector = [
    'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
    'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink',
    'font', 'plaintext', 'small', 'tt'
  ].join(',');
  unwrap_elements(doc.body, misc_selector);


  transform_form_elements(doc.body);
  unwrap_hidden_elements(doc.body);
  remove_consecutive_br_elements(doc);
  remove_consecutive_hr_elements(doc);
  remove_anchors_with_invalid_urls(doc.body);
  unwrap_non_link_anchors(doc.body);
  filter_sourceless_imgs(doc);

  // Deal with out of place elements
  filter_hr_children_of_lists(doc);
  adjust_block_inlines(doc);

  normalize_hairspace_entities(doc);
}

function transform_form_elements(ancestor_element) {
  if(!ancestor_element)
    return;

  // Unwrap forms
  const form_elements = ancestor_element.querySelectorAll('form');
  for(const form_element of form_elements)
    unwrap_element(form_element);

  // Unwrap labels
  const label_elements = ancestor_element.querySelectorAll('label');
  for(const label_element of label_elements)
    unwrap_element(label_element);

  // Remove form fields
  const input_selector =
    'button, fieldset, input, optgroup, option, select, textarea';
  const input_elements = ancestor_element.querySelectorAll(input_selector);
  for(const input_element of input_elements)
    input_element.remove();
}

function unwrap_hidden_elements(ancestor_element) {
  if(ancestor_element) {
    const doc_element = ancestor_element.ownerDocument.documentElement;
    const elements = ancestor_element.querySelectorAll('*');
    for(const element of elements)
      if(doc_element.contains(element) && is_hidden_element(element))
        unwrap_element(element);
  }
}

function remove_consecutive_br_elements(doc) {
  const elements = doc.querySelectorAll('br + br');
  for(const element of elements)
    element.remove();
}

// Look for all <hr><hr> sequences and remove the second one. Naive in that it
// does not fully account for new document state as hrs removed.
function remove_consecutive_hr_elements(doc) {
  const elements = doc.querySelectorAll('hr + hr');
  for(const element of elements)
    element.remove();
}

// This matches against children; not all descendants
// TODO: support dd or whatever it is
function filter_hr_children_of_lists(doc) {
  const elements = doc.querySelectorAll('ul > hr, ol > hr');
  for(const element of elements)
    element.remove();
}

function remove_anchors_with_invalid_urls(ancestor_element) {
  if(ancestor_element) {
    const anchor_elements = ancestor_element.querySelectorAll('a');
    for(const anchor_element of anchor_elements)
      if(is_invalid_anchor(anchor_element))
        anchor_element.remove();
  }
}

function is_invalid_anchor(anchor_element) {
  const href_value = anchor_element.getAttribute('href');
  return href_value && /^\s*https?:\/\/#/i.test(href_value);
}

// An anchor that acts like a span can be unwrapped
// Currently misses anchors that have href attr but is empty/whitespace
// TODO: restrict to body
function unwrap_non_link_anchors(ancestor_element) {
  if(ancestor_element) {
    const anchor_elements = ancestor_element.querySelectorAll('a');
    for(const anchor_element of anchor_elements)
      if(!anchor_element.hasAttribute('href'))
        unwrap_element(anchor_element);
  }
}

function filter_sourceless_imgs(doc) {
  const imgs = doc.querySelectorAll('img');
  for(const img of imgs)
    if(!img.hasAttribute('src') && !img.hasAttribute('srcset'))
      img.remove();
}

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
// TODO: this rearranges content in an unwanted way if when there is sibling
// content under the same inline. It takes the one block child and moves it
// to before its previous siblings which is basically corruption.
function adjust_block_inlines(doc) {
  const block_selector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inline_selector = 'a, span, b, strong, i';
  const blocks = doc.querySelectorAll(block_selector);
  for(const block of blocks) {
    const ancestor = block.closest(inline_selector);
    if(ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for(let node = block.firstChild; node; node = block.firstChild)
        ancestor.appendChild(node);
      block.appendChild(ancestor);
    }
  }
}

// TODO: accessing nodeValue does decoding, so maybe this doesn't work? Forgot.
// TODO: should this be restricted to body?
function normalize_hairspace_entities(doc) {
  const iterator = doc.createNodeIterator(
    doc.documentElement, NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    const value = node.nodeValue;
    const modified_value = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modified_value.length !== value.length)
      node.nodeValue = modified_value;
  }
}

this.sanitize_html_document = sanitize_html_document;

} // End file block scope
