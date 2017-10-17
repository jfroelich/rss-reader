// <br> element lib

'use strict';

/*
# TODO: replace br with p tags

What I essentially want to do is remove all BR elements and replace
them with paragraphs. This turns out to be very tricky because of the
need to consider a BR element's ancestors and whether those ancestors are
inline or not inline.

One idea. Ignore performance. Convert to string. find and replace br with
p. then recreate doc. Probably not a great idea. But at least it might work.

*/
function br_filter(doc) {
  ASSERT(doc);

  // Restrict analysis to body descendants
  if(!doc.body) {
    return;
  }

  // Filter consecutive brs
  const brs = doc.body.querySelectorAll('br + br');
  for(const br of brs) {
    br.remove();
  }
}
