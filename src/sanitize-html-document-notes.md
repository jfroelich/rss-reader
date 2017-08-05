
# TODO

* write tests

* Fix things like <b><table></table></b>, see https://html.spec.whatwg.org/multipage/parsing.html mentions of adoption
algorithm and its errata notes
* removing sourceless images should maybe take into account parent picture tag
if present

# Filtering hidden elements notes

Concerned about performance of using element.style. See https://bugs.chromium.org/p/chromium/issues/detail?id=557884#c2 . The issue was
closed, but they are claiming that element.style performance has been improved.
I need to revisit the performance of this function, and consider reverting back
to the style based approach. I think the best thing to do is setup a test case
that compares the performance of using element.style to querySelectorAll or
getAttribute or other methods.
