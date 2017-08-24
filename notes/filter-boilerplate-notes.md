
# About

Based on boilerpipe and BTE
http://www.l3s.de/~kohlschuetter/boilerplate

# TODO

* move all notes, comments, issues here
* create tests
* refactor prune to use compareDocumentPosition because I assume the performance
is better
* reintroduce support for annotating output
* Instead of finding the best element, gather elements containing text, and
return all above a threshold. Maybe just create a new document, which also
helps with purity. But make sure to somehow not doubly include nested elements.
Kind of like the block approach of a very old version of this?
* Reintroduce support for merging a multi-page article, probably requires an
async function and html fetching ability. Actually this belongs somewhere
else
* When calculating image bias, round to an integer, stop using floats
* When calculating image size, if one dimension is missing but other is present,
then maybe can simply assume the image is a square and use the same size for
both width and height. Forgot what I am doing now, I may only be calculating
area if both are present. Being able to assume one dimension leads to better
area calculation.

# Notes on using let/const

* Was getting errors in Chrome 55, maybe these have been addressed. Need to
run the function through the devtools profiler again, I have not done this in
quite a while.
* v8 deopt warning: Unsupported compound let statement
* v8 deopt warning: Unsupported use of phi const
* I do not truly understand these errors, but I know that switching back to
var instead of let/const avoids the error. Also, it looks like the warning
appears less frequently when using the long form of various syntax. For example,
when using x = x + y instead of x += y, the error does not always appear.

# TODO notes copied from github issue

* reintroduce support for annotating elements
* filter in-document titles
* consider scoring on a scale, or use probability
* revert to blocks instead of best element
* review justText thesis
