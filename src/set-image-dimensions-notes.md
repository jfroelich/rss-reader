
# TODO

* Change to not fetch if only one dimension is set. In this case just assume the
image is a square and set the missing dimension to the known dimension. I think
this is accurate most of the time. Or make it a parameter, a policy parameter
on whether to allow for either one or to require both. Also no need to even
modify if one is present. Instead make the area algorithm assume square.
* fetch img may need to use the fetch library internally, because
I want to avoid sending cookies and such.
* Undecided on whether fetch should accept a doc parameter so
that where the image element is created is configurable. Maybe it is a security
concern if loading an image is somehow XSS vulnerable? Maybe it is not safe to
assume that new Image() works in all contexts?
* This needs testing library that isolates specific branches of the code and
asserts that each section works as expected.
* Rather than use a custom error message when failing to fetch an image, look
into whether there is some error property of the image or the event that can be
used instead.
* Finish the infer from filename stuff

# Notes on possible fetch image issue

See https://stackoverflow.com/questions/4776670 . Apparently the proper
convention is to always trigger the fetch after attaching the handlers?

# Notes on data uris

fetch works with data uris. Can use the same proxy technique as fetch to
get the dimensions.
