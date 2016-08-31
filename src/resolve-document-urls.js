// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: I should revert to using localName below and the keys in this map
// should be lower case. This avoids the call to toUpperCase.
const URL_ATTRIBUTE_MAP = {
  'A': 'href',
  'APPLET': 'codebase',
  'AREA': 'href',
  'AUDIO': 'src',
  'BASE': 'href',
  'BLOCKQUOTE': 'cite',
  'BODY': 'background',
  'BUTTON': 'formaction',
  'DEL': 'cite',
  'EMBED': 'src',
  'FRAME': 'src',
  'HEAD': 'profile',
  'HTML': 'manifest',
  'IFRAME': 'src',
  'FORM': 'action',
  'IMG': 'src',
  'INPUT': 'src',
  'INS': 'cite',
  'LINK': 'href',
  'OBJECT': 'data',
  'Q': 'cite',
  'SCRIPT': 'src',
  'SOURCE': 'src',
  'TRACK': 'src',
  'VIDEO': 'src'
};

const SELECTOR = Object.keys(URL_ATTRIBUTE_MAP).map(function(key) {
  return key + '[' + URL_ATTRIBUTE_MAP[key] +']';
}).join(',');

function resolve_document_urls(document, base_url) {
  // Remove base elements so that base elements do not affect the UI
  const bases = document.querySelectorAll('base');
  for(let base of bases) {
    base.remove();
  }

  const elements = document.querySelectorAll(SELECTOR);
  for(let element of elements) {
    remove_if_invalid(element);
  }

  for(let element of elements) {
    resolve_element(element, base_url);
  }

  resolve_srcsets(document, base_url);
}

function remove_if_invalid(element) {
  const name = element.nodeName.toUpperCase();
  const attr = URL_ATTRIBUTE_MAP[name];
  if(attr) {
    const value = element.getAttribute(attr);
    if(/^\s*https?:\/\/#/i.test(value)) {
      element.remove();
    }
  }
}

function resolve_element(element, base_url) {
  const element_name = element.nodeName.toUpperCase();
  const attr_name = URL_ATTRIBUTE_MAP[element_name];
  if(!attr_name) {
    return;
  }

  const attr_url = element.getAttribute(attr_name);
  if(!attr_url) {
    return;
  }

  const resolved_url = resolve_url(attr_url, base_url);
  // TODO: inequality test is weak because it ignores spaces and
  // is case sensitive, maybe make it stronger
  if(resolved_url && resolved_url.href !== attr_url) {
    element.setAttribute(attr_name, resolved_url.href);
  }
}

function resolve_srcsets(document, base_url) {
  const elements = document.querySelectorAll('img[srcset], source[srcset]');
  for(let element of elements) {
    const attr_url = element.getAttribute('srcset');
    if(attr_url) {
      const srcset = parseSrcset(attr_url);
      if(srcset && srcset.length) {
        let dirtied = false;
        for(let descriptor of srcset) {
          const resolved_url = resolve_url(descriptor.url, base_url);
          if(resolved_url && resolved_url.href !== descriptor.url) {
            dirtied = true;
            descriptor.url = resolved_url.href;
          }
        }

        if(dirtied) {
          const new_srcset_value = serialize_srcset(srcset);
          if(new_srcset_value && new_srcset_value !== attr_url) {
            element.setAttribute('srcset', new_srcset_value);
          }
        }
      }
    }
  }
}

function resolve_url(url_string, base_url) {
  console.assert(url_string);
  if(!/^\s*javascript:/i.test(url_string) && !/^\s*data:/i.test(url_string)) {
    try {
      return new URL(url_string, base_url);
    } catch(error) {
      console.warn(url_string, base_url.href, error);
    }
  }
}

this.resolve_document_urls = resolve_document_urls;

} // End file block scope
