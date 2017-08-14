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


  transform_form_elements(doc);
  unwrap_hidden_elements(doc);
  remove_consecutive_br_elements(doc);
  remove_consecutive_hr_elements(doc);
  remove_anchors_with_invalid_urls(doc);
  unwrap_non_link_anchors(doc);
  filter_sourceless_imgs(doc);

  // Deal with out of place elements
  filter_hr_children_of_lists(doc);
  adjust_block_inlines(doc);

  replace_hairspace_entities(doc);
}

function transform_form_elements(doc) {
  if(!doc.body)
    return;

  // Unwrap forms
  const form_elements = doc.body.querySelectorAll('form');
  for(const form_element of form_elements)
    unwrap_element(form_element);

  // Unwrap labels
  const label_elements = doc.body.querySelectorAll('label');
  for(const label_element of label_elements)
    unwrap_element(label_element);

  // Remove inputs
  const input_selector = 'button, fieldset, input, optgroup, option, select, textarea';
  const input_elements = doc.body.querySelectorAll(input_selector);
  for(const input_element of input_elements)
    input_element.remove();
}


function unwrap_hidden_elements(doc) {
  if(!doc.body)
    return;

  // NOTE: this approach is less accurate but significantly faster than
  // accessing element.style
  const selector = [
    '[style*="display: none"]',
    '[style*="visibility: hidden"]',
    '[style*="opacity: 0.0"]',
    '[aria-hidden="true"]'
  ].join(',');

  // NOTE: using unwrap instead of remove at the moment due to issues with
  // sites that use script to show hidden content after load appearing to have
  // no content at all.
  // NOTE: checking contains to avoid modifying elements in detached subtrees

  const elements = doc.body.querySelectorAll(selector);
  const doc_element = doc.documentElement;
  for(const element of elements)
    if(doc_element.contains(element))
      unwrap_element(element);
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
function filter_hr_children_of_lists(doc) {
  const elements = doc.querySelectorAll('ul > hr, ol > hr');
  for(const element of elements)
    element.remove();
}

function remove_anchors_with_invalid_urls(doc) {
  const anchors = doc.querySelectorAll('a');
  for(const anchor of anchors)
    if(is_invalid_anchor(anchor))
      anchor.remove();
}

function is_invalid_anchor(anchor) {
  const href = anchor.getAttribute('href');
  return href && /^\s*https?:\/\/#/i.test(href);
}

// An anchor that acts like a span can be unwrapped
// Currently misses anchors that have href attr but is empty/whitespace
function unwrap_non_link_anchors(doc) {
  const anchors = doc.querySelectorAll('a');
  for(const anchor of anchors)
    if(!anchor.hasAttribute('href'))
      unwrap_element(anchor);
}

function filter_sourceless_imgs(doc) {
  const imgs = doc.querySelectorAll('img');
  for(const img of imgs)
    if(!img.hasAttribute('src') && !img.hasAttribute('srcset'))
      img.remove();
}

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.
function adjust_block_inlines(doc) {
  const block_selector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inline_selector = 'a';
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

function replace_hairspace_entities(doc) {
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
