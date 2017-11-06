'use strict';

// import rbl.js

function baseFilter(doc) {
  assert(doc instanceof Document);
  const bases = doc.querySelectorAll('base');
  for(const base of bases) {
    base.remove();
  }
}
