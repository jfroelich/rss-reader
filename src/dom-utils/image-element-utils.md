# image-element-utils

TODO: cleanup comments, be more concise

TODO: better ripple effects handling. This ties into knowledge of how a
document is modified by all filters. Several filters leave the document in a
variety of states without consideration of other filters. For example, if we
remove an image, and even if we remove figure/picture, then there is still
the possibility that this then results in a leaf node, such as a parent `div`
that is basically empty. In other words the ripple effects are recursive,
which changes the perspective of what remove is doing, and in hindsight makes
it rather naive and questionable whether it is worth it to even attempt to
consider any ripple effects at all.

TODO: Perhaps it would be better if, rather than removing, there was more of
a mark-sweep approach, where images and associated elements were marked for
removal rather than actually removed. This would allow for multiple reasons
for marking. But it would leave junk in there that other filters would have
to consider.

TODO: A similar concern is, for example, hidden elements. There is no point
to processing hidden elements because those are also removed. This naively
goes and considers picture/figure that may be hidden. So the work is
redundant because the concerns are separated. The joint concern is basically
removal. Which suggests the functional purpose should not be oriented based
on whether we are removing an image or some other kind of element, but
instead the action of removal of any content in a document. Something like a
'dom-removal' API, of which handling images and associated elements for
various reasons is just one concern. One of the reasons I have not really
solved it is that the solution ties into the entire design of the content
filters as a series of separate passes with separate concerns. The problem is
in the approach itself.
