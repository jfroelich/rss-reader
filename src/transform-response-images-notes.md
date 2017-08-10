
# copied from other doc

TODO: This text needs to be refined eventually. Write an about section

The srcset image might be different. That would be bad. On the other hand, any
srcset img present means it is suitable as the src of the image, which means
it must be pluggable. But ... as each image can be entirely different, that
fundamentally means I have to use the srcset instead of the src, and should
be swapping the src attribute. That kind of goes against the grain. So...
maybe it really is only a function of transform lazy images. Transform lazy
should not only look at non-src with viable alternate attribute, it should also
look at missing or empty src attribute with but with srcset.

Responsively loaded images are not truly lazy though. They are just responsive.
That basically suggests I should have a wholly separate transformation. So it
would make sense to create a response-image-filter function, that looks for
images where src is missing/empty, and but srcset is present, and then chooses
one of the srcset descriptors and substitutes its url, and its dimensions,
into the src and dimension attributes of the image.

It should probably run before the lazy image transform.

# TODO

* create and use a wrapper around parseSrcset that traps errors
and never returns undefined/null
