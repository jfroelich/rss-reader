// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Applies a series of filters to a document. Modifies the document
// in place. The filters are applied in a preset order so as to minimize the
// work done by each sequential step, and to ensure proper handling of
// things like frameset elements.
function sanitize_document(document) {
  filter_comment_nodes(document);
  filter_frames(document);
  filter_noscripts(document);
  filter_blacklisted_elements(document);
  filter_hidden_elements(document);
  adjust_block_inline_elements(document);
  filter_br_elements(document);
  filter_anchor_elements(document);
  filter_image_elements(document);
  filter_unwrappable_elements(document);
  filter_figures(document);
  filter_hair_spaces(document);
  condense_text_node_whitespace(document);
  unwrap_single_item_lists(document);

  const limit = 20;
  filter_table_elements(document, limit);
  filter_leaf_elements(document);
  filter_hr_elements(document);
  trim_document(document);
  filter_element_attributes(document);
}

// todo; should be part of some normalize whitespace general function?
function filter_hair_spaces(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const modified_val = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modified_val !== value) {
      console.debug('Replaced hair spaces', value, '=>', modified_val);
      node.nodeValue = modified_val;
    }
  }
}

// Unwraps <noscript> elements. Although this could be done by
// filter_unwrappable_elements, I am doing it here because I consider <noscript>
// to be a special case. This unwraps instead of removes because some documents
// embed the entire content in a noscript tag and then use their own scripted
// unwrapping call to make the content available.
//
// TODO: look into whether I can make a more educated guess about whether
// to unwrap or to remove. For example, maybe if there is only one noscript
// tag found, or if the number of elements outside of the node script but
// within the body is above or below some threshold (which may need to be
// relative to the total number of elements within the body?)
function filter_noscripts(document) {
  const elements = document.querySelectorAll('noscript');
  for(let i = 0, len = elements.length; i < len; i++) {
    unwrap_element(elements[i]);
  }
}

// TODO: what if both body and frameset are present?
// TODO: there can be multiple bodies when illformed. Maybe use
// querySelectorAll and handle multi-body branch differently
function filter_frames(document) {
  const frameset = document.body;
  if(!frameset || frameset.localName !== 'frameset') {
    return;
  }

  const body = document.createElement('body');
  const noframes = document.querySelector('noframes');
  if(noframes) {
    for(let node = noframes.firstChild; node; node = noframes.firstChild) {
      body.appendChild(node);
    }
  } else {
    const error_node = document.createTextNode(
      'Unable to display framed document.');
    body.appendChild(error_node);
  }

  frameset.remove();
  document.documentElement.appendChild(body);
}

// If a figure has only one child element, then it is useless.
// NOTE: boilerplate analysis examines figures, so ensure this is not done
// before it.
// TODO: is it actually useless?
function filter_figures(document) {
  const figures = document.querySelectorAll('FIGURE');
  for(let i = 0, len = figures.length; i < len; i++) {
    let figure = figures[i];
    if(figure.childElementCount === 1) {
      unwrap_element(figure);
    }
  }
}

this.sanitize_document = sanitize_document;

} // End file block scope
