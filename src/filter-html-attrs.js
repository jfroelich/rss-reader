// See license.md
'use strict';

function filter_html_attrs(doc) {
  const elements = doc.getElementsByTagName('*');
  for(const element of elements) {
    let local_name = element.localName;
    let attributes = element.attributes;
    if(!attributes || !attributes.length)
      continue;

    if(local_name === 'source') {
      for(let i = attributes.length - 1; i > -1; i--) {
        const attr_name = attributes[i].name;
        if(attr_name !== 'type' && attr_name !== 'srcset' &&
          attr_name !== 'sizes' && attr_name !== 'media' &&
          attr_name !== 'src')
          element.removeAttribute(attr_name);
      }
    } else if(local_name === 'a') {
      for(let i = attributes.length - 1; i > -1; i--) {
        const attr_name = attributes[i].name;
        if(attr_name !== 'href' && attr_name !== 'name' &&
          attr_name !== 'title')
          element.removeAttribute(attr_name);
      }
    } else if(local_name === 'iframe') {
      for(let i = attributes.length - 1; i > -1; i--) {
        const attr_name = attributes[i].name;
        if(attr_name !== 'src')
          element.removeAttribute(attr_name);
      }
    } else if(local_name === 'img') {
      for(let i = attributes.length - 1; i > -1; i--) {
        const attr_name = attributes[i].name;
        if(attr_name !== 'src' && attr_name !== 'alt' &&
          attr_name !== 'srcset' && attr_name !== 'title')
          element.removeAttribute(attr_name);
      }
    } else {
      for(let i = attributes.length - 1; i > -1; i--)
        element.removeAttribute(attributes[i].name);
    }
  }
}
