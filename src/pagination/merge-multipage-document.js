// Investigates whether a document is a multi-page document. If the document
// is a single page, the input document is left as is. If the document is a
// multipage document, the other pages are merged into the document and
// pagination elements are removed.
// @param doc {HTMLDocument} the document
// @param location {String} url of the document
// @param timeout_ms {Number} timeout per page fetch
async function merge_multipage_document(doc, location, timeout_ms) {
  'use strict';

  const lca_max_distance = 3;
  const anchors = find_pagination_anchors(doc, location, lca_max_distance);
  if(!anchors.length)
    return;

  const urls = [];
  for(const anchor of anchors)
    urls.push(anchor.getAttribute('href'));

  async function fetch_and_parse_html(url, timeout_ms) {
    const parser = new DOMParser();
    const response = await fetch_html(url, timeout_ms);
    const text = await response.text();
    return parser.parseFromString(text, 'text/html');
  }

  // Concurrently fetch the array of urls. If any fetch fails then this fails.
  const promises = [];
  for(const url of urls) {
    const promise = fetch_and_parse_html(url, timeout_ms);
    promises.push(fetch_promise);
  }

  let docs;
  try {
    docs = await Promise.all(promises);
  } catch(error) {
    // On fetch error, the merge fails
    // TODO: should I just not catch the error and expect caller to handle it?
    // Otherwise how would the caller differentiate between merge, no merge,
    // and no merge due to fetch error?
    console.debug(error);
    return;
  }

  // TODO: Merge the documents here. Copy each document's body into the body of
  // the main document.
  // TODO: once merged, remove the pagination information from the document
}

/*

# Notes

This is not going to work well with the best element approach of filter
boilerplate unless I intelligently merge the bodies. That is an issue with
how I filter boilerplate though. Or maybe I should be separately filtering
boilerplate per doc, not sure. Also, the pager is boilerplate, so maybe there
is sufficient overlapping concern that this should not be a separate transform.

TODO: when testing, mock the fetches. So the merge function must be
mockable

Test page

http://investingchannel.com/article/433394/One-Statistics-Professor-Was-Just-Banned-By-Google-Here-Is-His-Story
<div class="article_pagination">
<span>&lt; Prev</span>
<span> 1 </span>
<a href="?page_no=2"> 2 </a>
<a href="?page_no=3"> 3 </a>
<a href="?page_no=2">  Next &gt; </a>
<br></div>

* Note how next is same url
* Note how we do not want to refetch the initial url
* Note we could be visiting initially not the first url
* Note the urls are ordered and order matters
* Note how next is not a url (a naive find all links approach would be inaccurate)
like a page number explicitly
* Now how next implicitly needs to know current page number
* If a pager just has a next button, should it still be found as a pager? maybe?
probably.
* What about a pager that does not have a special container element? It just
has raw links?

Think about it like a classification algorithm. Looking at the elements of a page,
determine what is a pager. A pager is a collection of links to other pages, or next/prev
buttons and such.  So it could also just be a classification of the individual
links to other pages.


There may be elided pages. In general the count is increasing
(would it be correct to claim monotonically increasing by 1?). But there are also
just direct references to other pages that are not numbered.

One key feature would be whether the link has a url where the url, ignoring the
search params, and a part of the path, is very similar. Also, I need to account
for relative vs absolute urls here.

So a more general way would be to look for some closely located listing of urls
that are similar. e.g. domain must exactly match, path excluding file name must
exactly match, ignore search params, and where file name is nearly identical. Or,
where file name is present and identical and there are search parameters like page_no

Has this been done before?

Googling for paginagation

https://github.com/TeamHG-Memex/autopager

Actually look at this person's notes, these are some of the exact same ideas
I was ruminating over.

Copied and pasted form notes of autopager/model.py:

XXX: also tried, but not present in the final model:
* a feature which is 1 if the current link text is a number ``i`` and
  previous link text is ``i-1``;
* extracting number patterns from link text: replacing digits with X and
  characters with C (currently only numbers are replaced);
* replacing numbers with X, not just individual digits;
* character ngrams from raw link href (currently path and query are processed
  separately);
* using query parameter values, not only query parameter names;
* using element id and title attributes;
* all character ngrams or tokens from URL path (currently only a few hardcoded
  features based on path are used);
* string distance between link URL and page URL (Jaro-Winkler on absolute URLs
  was tried; for good results more URL preprocessing is needed);
* distance between URL components (a customized Jaccard distance)

Using something called CRF (Conditional Random Fields)

See:

* http://www.chokkan.org/software/crfsuite/
* http://www.aclweb.org/anthology/N03-1028
* https://www.npmjs.com/package/node-crf
* https://github.com/mas-hama/jscrf/blob/master/jscrf.js

So mostly looking at links. Look at all links. Look at various features of
links. Then is using CRF to look for a sequence. This is sometimes referred to
as sequence labeling.

I do not want to use a testing dataset, and I do not want to use probabilities.
I want just a hackish quick solution that is mostly rule based and extremely
fast.

Instead of using a pager, return an array of link nodes in the doc?

TODO: split up functionality into two separate files. One file is concerned
with transforming paginated documents. The other is concerned purely with
pagination functionality, like finding pagination.


TODO:
review
https://github.com/chromium/dom-distiller/blob/master/java/org/chromium/distiller/PagingLinksFinder.java

Side thought: find lowest common parent for links, and if links consume majority
of the html then consider that is the pager

One key thing that this does it is also finds pagination that is not numbered,
like just the presence of a "next" link in a document. This is kind of different
than what I was initially going for, in that i was looking for a sequence of
numbers. The algorithm just focuses on finding the 'next' link in the sequence,
rather than all page links at once.

Side thought: maybe just finding pagination elements if useful even without
merging. Maybe it is just another boilerplate category.  So maybe the merge
functionality should be optional, and the default is to not merge and just return
the pagination info found.

- require number text in features
It is not just that the sequence links have to have digits, they have to have
monotonically increasing digits in the same place. E.g. in the same place in
the url path, or in the url params, or in the url text. All the links must
follow the same pattern to be considered a sequence.

we may not even need to require digits, just an ascii monotonic increase, like
a-b-c or 1-2-3 or something. Also it is not always an increase by 1. It could
be an increase by 5, or 10, or whatever.

Also I may only want to impose the increasing-pattern requirement on a portion
of the links in a sequence, e.g. say 80% of the links, or tolerate
2 links of the sequence to be violations.

note i can also use the same pattern approach to node positioning. rather than
an abstract distance parameter between links, i can assert that paging
links all share the same positioning pattern. therefore, all page links must
be equidistant from the lowest common ancestor. this would also be a
requirement to impose.

todo: think about a one pass approach, maybe i can do the anchor validation in
the sequence building step instead of before it. develop an explanation for why
one approach is better or worse.

Next thing to do after migrate to pagination module:
- look for digit patterns in url path, url params, or anchor text. If one is
found then record it for that url. then when building a sequence, get the
pattern for a sequence's initial anchor. Then, when processing the next anchor,
check if the same pattern exists (and maybe also is +1).  If it exists then
append to sequence. If it does not exist then restart sequence.

- the pagination lib should return a pager object instead of raw urls

*/
