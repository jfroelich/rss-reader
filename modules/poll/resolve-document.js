// See license.md

'use strict';

{

const attr_map = {
  'a': 'href',
  'applet': 'codebase',
  'area': 'href',
  'audio': 'src',
  'base': 'href',
  'blockquote': 'cite',
  'body': 'background',
  'button': 'formaction',
  'del': 'cite',
  'embed': 'src',
  'frame': 'src',
  'head': 'profile',
  'html': 'manifest',
  'iframe': 'src',
  'form': 'action',
  'img': 'src',
  'input': 'src',
  'ins': 'cite',
  'link': 'href',
  'object': 'data',
  'q': 'cite',
  'script': 'src',
  'source': 'src',
  'track': 'src',
  'video': 'src'
};

function build_selector_part(key) {
  return `${key}[${attr_map[key]}]`;
}

const selector = Object.keys(attr_map).map(build_selector_part).join(',');

function resolve_doc(doc, log, base_url) {
  if(!parseSrcset)
    throw new ReferenceError();
  if(!is_url_object(base_url))
    throw new TypeError();

  log.log('Resolving document urls to base', base_url.href);
  const bases = doc.querySelectorAll('base');
  for(let base of bases) {
    base.remove();
  }

  const elements = doc.querySelectorAll(selector);
  for(let element of elements) {
    resolve_mapped_attr(element, base_url);
  }

  const srcsetEls = doc.querySelectorAll('img[srcset], source[srcset]');
  for(let element of srcsetEls) {
    resolve_srcset_attr(element, base_url);
  }
}

function resolve_mapped_attr(element, base_url) {
  const element_name = element.localName;
  const attr_name = attr_map[element_name];
  if(!attr_name)
    return;
  const attr_url = element.getAttribute(attr_name);
  if(!attr_url)
    return;
  const resolved_url = resolve_url(attr_url, base_url);
  if(resolved_url && resolved_url.href !== attr_url)
    element.setAttribute(attr_name, resolved_url.href);
}

function resolve_srcset_attr(element, base_url) {
  const attr_url = element.getAttribute('srcset');
  // The element has the attribute, but it may not have a value. parseSrcset
  // requires a value or it throws (??).
  if(!attr_url)
    return;
  const srcset = parseSrcset(attr_url);
  // The parseSrcset function may fail to parse (??)
  if(!srcset || !srcset.length)
    return;
  let dirtied = false;
  for(let descriptor of srcset) {
    const resolved_url = resolve_url(descriptor.url, base_url);
    if(resolved_url && resolved_url.href !== descriptor.url) {
      dirtied = true;
      descriptor.url = resolved_url.href;
    }
  }

  if(dirtied) {
    const new_srcset_val = serialize_srcset(srcset);
    if(new_srcset_val)
      element.setAttribute('srcset', new_srcset_val);
  }
}

// @param descriptors {Array} an array of basic descriptor objects such as the
// one produced by the parseSrcset library
function serialize_srcset(descriptors) {
  const output = [];
  for(let descriptor of descriptors) {
    let buf = [descriptor.url];
    if(descriptor.d) {
      buf.push(' ');
      buf.push(descriptor.d);
      buf.push('x');
    } else if(descriptor.w) {
      buf.push(' ');
      buf.push(descriptor.w);
      buf.push('w');
    } else if(descriptor.h) {
      buf.push(' ');
      buf.push(descriptor.h);
      buf.push('h');
    }
    output.push(buf.join(''));
  }
  return output.join(', ');
}


// @param url_str {String}
// @param base_url {URL}
function resolve_url(url_str, base_url) {
  if(typeof url_str !== 'string')
    throw new TypeError();
  if(!is_url_object(base_url))
    throw new TypeError();
  // TODO: use a single regex for speed? Or maybe get the protocol,
  // normalize it, and check against a list of bad protocols?
  // TODO: or if it has any protocol, then just return the url as is?
  // - but that would still require a call to new URL
  if(/^\s*javascript:/i.test(url_str) ||
    /^\s*data:/i.test(url_str) ||
    /^\s*mailto:/i.test(url_str))
    return;
  try {
    return new URL(url_str, base_url);
  } catch(error) {
    console.warn(url_str, base_url.href, error);
  }
}

this.resolve_doc = resolve_doc;



}
