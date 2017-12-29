import assert from "/src/common/assert.js";
import {parseSrcsetWrapper} from "/src/common/dom-utils.js";

const ELEMENT_ATTRIBUTE_MAP = {
  a: 'href',
  applet: 'codebase',
  area: 'href',
  audio: 'src',
  base: 'href',
  blockquote: 'cite',
  body: 'background',
  button: 'formaction',
  del: 'cite',
  embed: 'src',
  frame: 'src',
  head: 'profile',
  html: 'manifest',
  iframe: 'src',
  form: 'action',
  img: 'src',
  input: 'src',
  ins: 'cite',
  link: 'href',
  object: 'data',
  q: 'cite',
  script: 'src',
  source: 'src',
  track: 'src',
  video: 'src'
};

// Initialize ELEMENTS_WITH_SRC_SELECTOR once on module load in module scope
const tags = Object.keys(ELEMENT_ATTRIBUTE_MAP);
const parts = [];
for(const tag of tags) {
  parts.push(`${tag}[${ELEMENT_ATTRIBUTE_MAP[tag]}]`);
}
const ELEMENTS_WITH_SRC_SELECTOR = parts.join(',');

// @param doc {Document}
// @param baseURL {URL}
export default function filterDocument(doc, baseURL) {
  assert(doc instanceof Document);
  assert(baseURL instanceof URL);

  const srcElements = doc.querySelectorAll(ELEMENTS_WITH_SRC_SELECTOR);
  for(const srcElement of srcElements) {
    resolveElementAttribute(srcElement, baseURL);
  }

  if(doc.body) {
    const srcsetElements = doc.body.querySelectorAll('img[srcset], source[srcset]');
    for(const srcsetElement of srcsetElements) {
      resolveSrcset(srcsetElement, baseURL);
    }
  }
}

function resolveElementAttribute(element, baseURL) {
  const attributeName = ELEMENT_ATTRIBUTE_MAP[element.localName];
  if(!attributeName) {
    return;
  }

  const originalURLString = element.getAttribute(attributeName);
  if(!originalURLString) {
    return;
  }

  const resolvedURL = resolveURLString(originalURLString, baseURL);
  if(!resolvedURL) {
    return;
  }

  // TODO: if this is simply appending the slash, maybe it shouldn't. Technically the slash is
  // implicit, and just a waste of space. Space saving is also a concern. Maybe it should be a
  // concern of a separate filter that removes unimportant characters from urls, or maybe it should
  // just also be a concern of this module? Maybe I do something extra here like just check if
  // path is empty or just a '/', and if so, use .href.substring(-1) or something like that? Maybe
  // that should be encapsulated in some helper function call too, like getCondensedURLString?
  // Also, I think URL serialization leaves in '?' even when parameter count is 0, so maybe also
  // consider that. Also, if I do it here, I should do it for srcset too?
  // Or wait, maybe this is dumb for certain elements that point to actual resources. For example
  // image urls pretty much all have paths. So this is really only for things like anchors? Maybe
  // it really is just too much of a separate concern, but I suppose the aggregate concern is
  // performance, because I suspect using a separate filter would require re-parsing the url. So I
  // really should do it here. For that matter, I should be doing it almost anywhere I set an
  // attribute that contains a url, for those attributes not pointing to files necessarily.
  // Also, if I do the substring thing, I still want to check if length is not equal to avoid the
  // cost of setAttribute. So I have to do two length checks. So maybe what I should do is rewrite
  // this condition to check if lengths equal then return early, otherwise do stuff. The return
  // early style would be consistent with earlier sections of this function.
  // Also maybe store resolvedURL.href in a variable like canonicalURLString. It mirrors the
  // variable originalURLString better, and avoids the possible case that Chrome doesn't do
  // lazy-setter-call-memoization?

  // Another note. If I am doing condense, then I may still want to condense the original url
  // EVEN IF it did not change due to canonicalization. So it should not only be done for
  // length change. So the exit early thing would be less convenient, or rather, naive.

  // TODO: separate concern, https://github.com/omidh28/clarifyjs#### should be changed to
  // https://github.com/omidh28/clarifyjs# or just https://github.com/omidh28/clarifyjs

  // TODO: separate idea to explore, what if i have a url-condense-filter that is also site aware
  // and does things like (if stackoverflow keep only the question id part of the url and strip
  // the rest)? At this point I am moving way beyond the concerns of canonicalization and in this
  // sense, it really seems more appropriate to have any condense concerns be apart of this other
  // filter and not here since I am going to just deal with the perf cost of re-parsing. Or,
  // maybe performance is the definining concern, and really, I should be using a more general
  // filter concept like "url-filter.js" that does both canonicalization and condense filters at
  // once, because performance trumps over concern-based organization of functionality?

  if(resolvedURL.href.length !== originalURLString.length) {

    // TEMP: monitoring urls for above todo. This is going to spam but I think I will probably
    // focus on the todo rather soon.
    //console.debug('canonicalization change', originalURLString, resolvedURL.href);

    // NOTE: gathering some interesting messages
    // - if url is just '#' then it becomes just full link with # appended. I probably should not
    // be trying to canonical mailto at all.
    // - if url is mailto, it basically just encodes the url (e.g. spaces escaped). Probably should
    // just strip the #? Beware the bug i had last time with google groups urls, a webserver can
    // interpret # as ?
    // - https://play.freeciv.org https://play.freeciv.org/  . So yep, this is exactly the concern,
    // that i talked above above, all that canonicalization accomplished was add a trailing slash.


    element.setAttribute(attributeName, resolvedURL.href);
  }
}

function resolveSrcset(element, baseURL) {
  const srcsetAttributeValue = element.getAttribute('srcset');
  const descriptors = parseSrcsetWrapper(srcsetAttributeValue);

  let changeCount = 0;
  for(const descriptor of descriptors) {
    const resolvedURL = resolveURLString(descriptor.url, baseURL);
    if(resolvedURL && resolvedURL.href.length !== descriptor.url.length) {
      descriptor.url = resolvedURL.href;
      changeCount++;
    }
  }

  if(changeCount) {
    const newValue = serializeSrcset(descriptors);
    if(newValue) {
      element.setAttribute('srcset', newValue);
    }
  }
}

// TODO: maybe inline
function resolveURLString(urlString, baseURL) {
  assert(baseURL instanceof URL);

  // Allow for bad input for caller convenience
  // If the url is not a string (e.g. undefined), return undefined
  if(typeof urlString !== 'string') {
    return;
  }

  // Check if urlString is just whitespace. If just whitespace, then return undefined. This departs
  // from the behavior of the URL constructor, which tolerates an empty or whitespace string as
  // input. The url constructor in that case will create a new URL from the base url exclusively.
  // That is misleading for this purpose.

  // If the length of the string is 0 then return undefined
  if(!urlString) {
    return;
  }

  // If the trimmed length of the string is 0 then return undefined
  if(!urlString.trim()) {
    return;
  }

  let canonicalURL;
  try {
    canonicalURL = new URL(urlString, baseURL);
  } catch(error) {
    // Ignore
  }
  return canonicalURL;
}


// @param descriptors {Array} an array of descriptors such as those produced by parseSrcset
// @returns {String} a string suitable for storing as srcset attribute value
function serializeSrcset(descriptors) {
  assert(Array.isArray(descriptors));

  const descriptorStrings = [];
  for(const descriptor of descriptors) {
    const strings = [descriptor.url];
    if(descriptor.d) {
      strings.push(' ');
      strings.push(descriptor.d);
      strings.push('x');
    } else if(descriptor.w) {
      strings.push(' ');
      strings.push(descriptor.w);
      strings.push('w');
    } else if(descriptor.h) {
      strings.push(' ');
      strings.push(descriptor.h);
      strings.push('h');
    }

    const descriptorString = strings.join('');
    descriptorStrings.push(descriptorString);
  }

  return descriptorStrings.join(', ');
}
