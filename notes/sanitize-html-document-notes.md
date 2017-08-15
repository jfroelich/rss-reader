
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

- not using element.style is resulting in what appears to be a large number of
false positives. perhaps the perf increase is not worth it.

# Filtering tiny images

Removing telemetry image <img src="s.gif" height="1" width="0">

I am requiring both dimensions in transform_telemetry_elements now, so it
will no longer catch these. That means sanitize has to look for these and
remove them if desired.

# TODO: ideas for improvements (copied from old github issue)

This originally removed elements. Now it just unwraps. This helps avoid an issue with documents that wrap all content in a hidden element and then dynamically unhide the element. For example: view-source:http:stevehanov.ca/blog/index.php?id=132. This pages uses a main div with inline visibility hidden, and then uses an inline script at the bottom of the page that sets the visibility to visible. I also think this is a document produced by Macromedia Dreamweaver, so this is not pathological.

I have mixed feelings about revealing hidden content. There is an ambiguity regarding whether the content is useful. It is either content subject to the un-hide trick, or it is content that is intentionally hidden for some unknown reason by the author. It does not happen very often anymore but some authors hide content maliciously to fool search engines or simply because it is remnant of drafting the page, or because it is auxiliary stuff, or because it is part of some scripted component of the page.

Now that this unwraps, do additional testing to see if unwrapped content appears. Maybe a middle ground is to remove if removing does not leave an empty body. As in, if the parent is body, unwrap, otherwise remove.

Removing nodes that reside in a node already removed is harmless. However, it is a wasted operation, and dom operations are generally expensive. This checks 'contains' so as to avoid removing elements that were already removed in a prior iteration. Nodes are walked in document order because that is how querySelectorAll produces its NodeList content. Therefore descendants are visited after ancestors. Therefore it is possible to iterate over descendants that reside in an ancestor that was already removed.

I would prefer to not even visit such descendants. I suppose I could use a TreeWalker. However, I have found that tree walking is slow.

However, maybe it is worth it to experiment again.

# TODO: replace br with p tags

What I essentially want to do is remove all BR elements and replace them with paragraphs. This turns out to be very tricky because of the need to consider a BR element's ancestors and whether those ancestors are inline or not inline.

# TODO: improve noscript handling

Look into whether I can make a more educated guess about whether to unwrap or to remove. For example, maybe if there is only one noscript tag found, or if the number of elements outside of the node script but within the body is above or below some threshold (which may need to be relative to the total number of elements within the body?)

One of the bigger issues is that I show a lot of junk in the output. Maybe the boilerplate filtering should be picking it up, but right now it doesn't.
