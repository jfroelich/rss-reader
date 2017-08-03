// See license.md

function truncate_html(html_string, position, extension_string) {
  'use strict';

  if(!Number.isInteger(position) || position < 0)
    throw new TypeError('Invalid position ' + position);

  var ellipsis = '\u2026';
  var extension = extension_string || ellipsis;
  var doc = document.implementation.createHTMLDocument();
  doc.documentElement.innerHTML = html_string;
  var node_iterator = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var is_accepting_text = true;
  var total_length = 0;

  for(var node = node_iterator.nextNode(); node;
    node = node_iterator.nextNode()) {
    if(!is_accepting_text) {
      node.remove();
      continue;
    }

    var value = node.nodeValue;
    var value_length = value.length;
    if(total_length + value_length >= position) {
      is_accepting_text = false;
      var remaining = position - total_length;
      node.nodeValue = value.substr(0, remaining) + extension;
    } else
      total_length = total_length + value_length;
  }

  var output_html = /<html/i.test(html_string) ? doc.documentElement.outerHTML :
    doc.body.innerHTML;
  return output_html;
}
