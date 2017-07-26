
# About

Lazily loaded images are img elements specified in the html source that, once
the browser both loads the script and the html, runs a script on load handler
that transforms the elements into valid ones. This technique is done to ensure
that the html is loaded first and prevents the browser from loading images until
the html is loaded.

When working with a Document object where script was removed/disabled, one of
the problems is that several lazily-loaded images are left in the document.
If and when the document is later displayed, the images all have loading errors.
Or, because the images do not have a src attribute, the images are removed
when filtering out sourceless images, which kind of destroys the integrity of
some documents.

This attempts to convert lazy-loaded images back into normal image elements.

It is not entirely accurate. It only handles situations where the image is
missing a src. Some approaches to lazy loading provide both a src attribute and
an alternative attribute. Furthermore, of those approaches, one approach will
provide a valid looking src value that points to a place holder image, so that
it sort of still works in a scriptless environment.

There are also situations where even the alternate value is not an actual url
but instead some type of seed parameter to a lazy loading method that turns the
image into one with a valid source.

In other words, it is a problem of ambiguity. I cannot correctly distinguish
between a normal image and a lazily loaded one in all cases.

As a whole, this function is essentially a functional transformation, or
mapping, from one document into another. However, for performance reasons,
creating an entirely new document is not reasonable. Therefore this modifies
the input document in place.

# Notes

This is designed as an independent lib. I do know of another area of the app
that removes sourceless images. Generally, this should always be called prior
to that. However, this makes no assumptions. Similarly, this should always be
called prior to any code the validates or works with the urls in the src
attribute.

# Todo

* would it be better to use a querySelectorAll that looks for images without
certain attributes, instead of filtering in memory?
* Provide options to allow caller to easily change which attributes are used
instead of using a hardcoded list.
