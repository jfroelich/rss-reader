// See license.md
'use strict';

{ // Begin file block scope

function dnt_html_document(doc, verbose) {
  remove_ping_attribute_from_anchor_elements(doc);
  add_no_referrer_to_anchor_elements(doc);

  // TODO: this should probably be a parameter to dnt_html_document
  const min_dimension_value = 2;
  remove_small_images(doc, min_dimension_value, verbose);
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

function remove_small_images(doc, min_dimension_value, verbose) {
  const images = doc.querySelectorAll('img');

  // TODO: this should not just be checking against prop, maybe it should
  // be checking against attribute value? unclear.
  // TODO: the bug may be that this is removing everything because images have
  // width and height props of 0 at this point in inert doc.

  // TODO: so this has to happen before fetch in set_img_dimensions but what
  // about all the other size inferences that happen there before fetch that
  // would be useful here? Cross cutting concern maybe. But I want independence
  // so it almost feels like I need to repeat some of the conditions.

  // TODO: a quick way to at least isolate if this is the source of no-imgs
  // bug is to just disable it...

  for(const img of images)
    if(img.width < min_dimension_value || img.height < min_dimension_value) {
      if(verbose)
        console.debug('Removing small image', img);
      img.remove();
    }
}

this.dnt_html_document = dnt_html_document;

} // End file block scope
