
# Notes

This is not going to work well with the best element approach of filter
boilerplate unless I intelligently merge the bodies. That is an issue with
how I filter boilerplate though. Or maybe I should be separately filtering
boilerplate per doc, not sure. Also, the pager is boilerplate, so maybe there
is sufficient overlapping concern that this should not be a separate transform.

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
