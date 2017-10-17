// adoption agency lib

'use strict';

// Looks for cases such as <a><p>text</p></a> and transforms them into
// <p><a>text</a></p>.

// TODO: this rearranges content in an unwanted way if when there is sibling
// content under the same inline. It takes the one block child and moves it
// to before its previous siblings which is basically corruption/mangling

// TODO: Fix things like <b><table></table></b>, see
// https://html.spec.whatwg.org/multipage/parsing.html


function adoption_agency_filter(doc) {

  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  // TODO: integrate more cleanly, this is a quick fix during refactoring
  // special case for hr in list
  adoption_agency_filter_fix_hr_in_list(doc);

  const block_selector = 'blockquote, h1, h2, h3, h4, h5, h6, p';
  const inline_selector = 'a, span, b, strong, i';
  const blocks = doc.body.querySelectorAll(block_selector);
  for(const block of blocks) {
    const ancestor = block.closest(inline_selector);
    if(ancestor && ancestor.parentNode) {
      ancestor.parentNode.insertBefore(block, ancestor);
      for(let node = block.firstChild; node; node = block.firstChild)
        ancestor.appendChild(node);
      block.appendChild(ancestor);
    }
  }
}

// This matches against children; not all descendants
// TODO: support dl
function adoption_agency_filter_fix_hr_in_list(doc) {
  const elements = doc.body.querySelectorAll('ul > hr, ol > hr');
  for(const element of elements)
    element.remove();
}
