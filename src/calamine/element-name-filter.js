// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

  // Blacklist/whitelist filtering
lucu.calamine.filterElementsByName = function(doc) {



  // TODO: maybe this should be two queries that directly
  // use blacklist/whitelist selector to pull up elements. It seems
  // kind of dumb to iterate over all elements and call element.matches
  // but that is kinda wonky with whitelist, the selector would have
  // to use CSS not() for every element?

  var elements = doc.body.querySelectorAll('*');
  lucu.element.forEach(elements, lucu.calamine.filterByElementName);
};

// TODO: move iframe from blacklist to whitelist once supported
// Filters according to blacklist and whitelist

lucu.calamine.filterByElementName = function(element) {

  // A defensive guard just because of oddities with removing
  // while iterating (e.g. querySelectorAll vs getElementsByTagName)
  if(!element) {
    return;
  }

  if(element.matches(lucu.calamine.SELECTOR_BLACKLIST)) {
    lucu.node.remove(element);
    return;
  }

  if(!element.matches(lucu.calamine.SELECTOR_WHITELIST)) {
    lucu.node.remove(element);
    return;
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

lucu.calamine.SELECTOR_WHITELIST = 'a,abbr,acronym,address,area,'+
  'article,aside,audio,b,bdi,bdo,big,br,blockquote,'+
  'canvas,caption,center,cite,code,col,colgroup,'+
  'command,data,details,dir,dd,del,dfn,div,dl,dt,em,'+
  'entry,fieldset,figcaption,figure,font,footer,header,'+
  'help,hgroup,hr,h1,h2,h3,h4,h5,h6,i,img,ins,insert,'+
  'inset,label,li,kbd,main,mark,map,meter,nav,nobr,'+
  'noscript,ol,p,pre,progress,q,rp,rt,ruby,s,samp,section,'+
  'small,span,strike,strong,st1,sub,summary,sup,vg,table,'+
  'tbody,td,tfood,th,thead,time,tr,track,tt,u,ul,var,video,'+
  'wbr';
