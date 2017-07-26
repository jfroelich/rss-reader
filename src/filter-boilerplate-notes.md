
# About

Based on boilerpipe and BTE
http://www.l3s.de/~kohlschuetter/boilerplate

# TODO

* move random notes back into here
* create tests
* refactor prune to use compareDocumentPosition
* reintroduce support for annotating output
* Instead of finding the best element, gather elements containing text, and
return all above a threshold. Maybe just create a new document, which also
helps with purity.
** But make sure to somehow not doubly include nested elements
** Kind of like the block approach of a very old version of this?
* Reintroduce support for merging a multi-page article, probably requires an
async function and html fetching ability
* When calculating image bias, round to an integer, stop using floats
* because individual functions need to be testable maybe a namespace object
is in fact better?

Notes on using var vs const
* V8 deopt warning "unsupported compound let statement"
* Using var due to v8 deopt warnings - Unsupported use of phi const
* Using long form to try and avoid error (foo = foo + bar instead of foo+=bar)
