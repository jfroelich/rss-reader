// See license.md
'use strict';

{ // Begin file block scope

function dnt_html_document(doc) {
  remove_ping_attribute_from_anchor_elements(doc);
  add_no_referrer_to_anchor_elements(doc);

  // TODO: this should probably be a parameter to dnt_html_document
  const min_dimension_value = 2;
  remove_small_images(doc, min_dimension_value);
}

function remove_ping_attribute_from_anchor_elements(doc) {
  const anchors = doc.querySelectorAll('a');
  for(const anchor of anchors)
    anchor.removeAttribute('ping');
}

function add_no_referrer_to_anchor_elements(doc) {
  const anchors = doc.querySelectorAll('a');
  for(const anchor of anchors)
    anchor.setAttribute('rel', 'noreferrer');
}


function remove_small_images(doc, min_dimension_value) {
  const images = doc.querySelectorAll('img');
  for(const img of images)
    if(img.width < min_dimension_value || img.height < min_dimension_value)
      img.remove();
}

this.dnt_html_document = dnt_html_document;

} // End file block scope
