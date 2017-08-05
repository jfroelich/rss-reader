
# TODO

* I reverted the code to use setAttribute instead of setting property. I am not
sure what I was thinking. I am fairly confident that I always want to be
setting attributes, not properties. When setting an attribute the property will
be implicitly updated. But now I need to test the new approach
* Eventually remove the commented out set property code after further testing
* fetch_and_update_img may need to use the fetch library internally, because
I want to avoid sending cookies and such.
* infer from url params, like image.jpg?w=1234&h=5678. This is a common
case for wordpress. Could also check for width,height. This would reduce the
number of fetches made in some cases.
* Can derive from srcset as well, dimensions are available there for
width and height sometimes, for example, could grab one of the sizes
<img src="url" srcset="url 640w, url 680w, url 840w"> and assume the image is
a square, or at least set one of the sizes and avoid fetch?
* I think I want to refactor fetch_and_update_img so that it only fetches, and
do any updating in caller context. This makes the function have a purer purpose,
more of a single purpose, and do only one thing instead of two so that the
function is more composable.
* Undecided on whether fetch_and_update_img should accept a doc parameter so
that where the image element is created is configurable. Maybe it is a security
concern if loading an image is somehow XSS vulnerable? Maybe it is not safe to
assume that new Image() works in all contexts?
* This needs testing library that isolates specific branches of the code and
asserts that each section works as expected.
* allowed_protocols should maybe be a parameter to the function that defaults to
its current value if undefined
* Rather than use a custom error message when failing to fetch an image when
calling fetch_and_update_img, look into whether there is some error property
of the image or the event that can be used instead. I think it would be better
to use the built in error message. This would also be more consistent with out
other errors are created/accessed such as in the various functions that access
indexedDB that reject with result.error.
* Not sure if infer from style section of the code entirely correct, because the
condition is image.style.width, which is false when width is 0, which is not
what I want, because technically that is an explicit dimension. What I think I
want to be doing instead of checking if not undefined? But unsure, because these
properties might always be defined? And if defined, what are the defaults? It
is not always a number, right? It could be some css key word like "inherit" or
whatever.

The reason this sets attributes instead of simply setting properties is that this
way I ensure that when serializing the document back to html, the properties are
retained. I am not sure if the serializer, given that I rely on browser by
calling something like document.documentElement.innerHTML, knows to print out
width and height attributes explicitly.  But that actually really isn't the
concern, the concern is regarding other functionality that relies on image
dimensions, such as code that filters tiny images, or boilerplate filter code that
calculates boilerplate bias based on image dimensions.


# cases to fix
