// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

// TODO: rename this file to filter-elements-by-name or something
// similar to its main function, or something based on black/white
// list filtering. It is equally appropriate to think of elements
// as elements, and filter by element, as opposed to by name which
// has more to do with the string tag name. We could easily
// be filtering by instanceof for example.
// TODO: move iframe from blacklist to whitelist once supported


// Blacklist/whitelist filtering
lucu.calamine.filterElementsByName = function(doc) {

  // TODO: maybe this should be two queries that directly
  // use blacklist/whitelist selector to pull up elements. It seems
  // kind of dumb to iterate over all elements and call element.matches

  // But ... that is kinda wonky with whitelist because the selector
  // would have to use CSS not() for every element?

  var elements = doc.body.querySelectorAll('*');
  lucu.element.forEach(elements, lucu.calamine.filterByElementName);
};


// Filters according to blacklist and whitelist
lucu.calamine.filterByElementName = function(element) {


  // TODO: this is re-removing elements that were already detached
  // because those elements are included in the querySelectorAll
  // nodelist despite the parent of the element being removed
  // Find out how to quickly tell if an element is already detached
  // and if so how to skip it. Maybe it has to do with how we are
  // iterating, in that maybe treewalker/nodeiterator would be smart
  // to skip the children of removing elements




  // A defensive guard just because of oddities with removing
  // while iterating (e.g. querySelectorAll vs getElementsByTagName)
  if(!element) {
    return;
  }

  // NOTE: there is no real benefit to requiring lucu.node.remove
  // when we have direct access to element.remove.
  // Unless, of course, we change this so that we use
  // the selectors to find the elements instead of iterating over
  // all elements


  // NOTE: matches works differently for namespaced elements. It turns out that
  // in my previous approach where I was using localName, I was catching these
  // ignoring the namespace by using localName. But this no longer works. As
  // such all namespaced elements (e.g. g:plusone) fall through to the whitelist
  // test (and then fail it and are effectively removed).

  if(element.matches(lucu.calamine.SELECTOR_BLACKLIST)) {
    element.remove();
    return;
  }

  if(!element.matches(lucu.calamine.SELECTOR_WHITELIST)) {

    console.debug('Removing element not in white list %s', element.outerHTML);

    element.remove();

  }
};

// TODO: separate these into multiple lines, use array.join
// or something. A list with one thing per line in alphabetical
// order will be much easier to maintain.

lucu.calamine.SELECTOR_BLACKLIST = 'applet,base,basefont,button,'+
  'command,datalist,dialog,embed,fieldset,frame,frameset,'+
  'html,head,iframe,input,legend,link,math,meta,noframes,'+
  'object,option,optgroup,output,param,script,select,style,'+
  'title,textarea';

// NOTE: this must include 'form', even though we unwrap it later

lucu.calamine.SELECTOR_WHITELIST =
'a,'+
'abbr,'+
'acronym,'+
'address,'+
'area,'+
'article,'+
'aside,'+
'audio,'+
'b,'+
'bdi,'+
'bdo,'+
'big,'+
'br,'+
'blockquote,'+
'canvas,'+
'caption,'+
'center,'+
'cite,'+
'code,'+
'col,'+
'colgroup,'+
'command,'+
'data,'+
'details,'+
'dir,'+
'dd,'+
'del,'+
'dfn,'+
'div,'+
'dl,'+
'dt,'+
'em,'+
'entry,'+
'fieldset,'+
'figcaption,'+
'figure,'+
'font,'+
'footer,'+
'form,'+
'header,'+
'help,'+
'hgroup,'+
'hr,'+
'h1,'+
'h2,'+
'h3,'+
'h4,'+
'h5,'+
'h6,'+
'i,'+
'img,'+
'ins,'+
'insert,'+
'inset,'+
'label,'+
'li,'+
'kbd,'+
'main,'+
'mark,'+
'map,'+
'meter,'+
'nav,'+
'nobr,'+
'noscript,'+
'ol,'+
'p,'+
'pre,'+
'progress,'+
'q,'+
'rect,'+
'rp,'+
'rt,'+
'ruby,'+
's,'+
'samp,'+
'section,'+
'small,'+
'span,'+
'strike,'+
'strong,'+
'st1,'+
'sub,'+
'summary,'+
'sup,'+
'svg,'+
'table,'+
'tbody,'+
'td,'+
'tfood,'+
'th,'+
'thead,'+
'time,'+
'tr,'+
'track,'+
'tt,'+
'u,'+
'ul,'+
'var,'+
'video,'+
'wbr';
