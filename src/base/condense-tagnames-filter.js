import {coerce_element} from '/src/base/coerce-element.js';

export function condense_tagnames_filter(document, copy_attrs_flag) {
  // Analysis is restricted to body.
  if (!document.body) {
    return;
  }

  condense_tagname(document, 'strong', 'b', copy_attrs_flag);
  condense_tagname(document, 'em', 'i', copy_attrs_flag);
}

function condense_tagname(document, name, new_name, copy_attrs_flag) {
  const elements = document.body.querySelectorAll(name);
  for (const element of elements) {
    coerce_element(element, new_name, copy_attrs_flag);
  }
}
