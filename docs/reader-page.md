# About reader-page
This is an alternate view to the slideshow-page view. This is in part a rewrite of the slideshow-view. Here, I am focusing on using a more traditional user interface. I may not even like it. However, I think that at the moment it is better to try a traditional approach than one that might be too creative. I've also run into problems with the creative design, because the slideshow design does not lend itself well to other desired features, like viewing articles by feed, viewing read versus unread, and so forth.

In this view the goal is to focus on a left menu, and content on the right. The goal is to focus on an article list, with easy drilling down into the full article view.

Implementing this alternate view is also an adventure. I want to see clearly what functionality I have tied too much into the slideshow view itself, and that should instead exist at a lower layer. Implementing this secondary view and finding that I have to reimplement anything will be a clear indication of bad layering.

One of the driving goals is to re-implement much of the old Google Reader interface that many people like so much. I want to implement it first, and then improve upon it, instead of trying to just create my own view.

### Current development task
* implement current-view switch
* use .truncate css class instead of js-based truncation

### Upcoming development tasks short term


### Upcoming development tasks long term
* every time article is read, the total unread count in the page needs to update
* optimize the loading of data
* add subscription mechanism
* should not be using live urls for favicons, should be loading some local image from some kind of cache or something, should not be pinging servers
* should be able to tell if a favicon failed to load and unset it, right now i can see 404 error images (the broken image icon) for some feeds
* react to channel events
* support custom display settings
* deprecate slideshow and switch the default view displayed on badge click
