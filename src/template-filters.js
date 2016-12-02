// See license.md

'use strict';

// A global singleton used by polling. Overlaps with BoilerplateFilter
const BP_TEMPLATE_FILTER = new TemplateFilter();

// TODO: blanking the page sometimes
BP_TEMPLATE_FILTER.add('www.washingtonpost.com', ['header#wp-header',
  'div.top-sharebar-wrapper',
  'div.newsletter-inline-unit',
  'div.moat-trackable'
]);

// TODO: bug, seems to be blanking the page
// Best guess, I am removing the wrong element?
// I need to write a test that exclusively tests the template filter
// module, and test it against specific urls
// BP_TEMPLATE_FILTER.add('theweek.com', ['div#head-wrap']);

BP_TEMPLATE_FILTER.add('www.usnews.com', ['header.header']);
