
# simplify storage

do not store feeds store. just store everything in an entries store. store
feed data redundantly per entry. rethink how to do queries like get all feeds,
how to archive, etc

#security issue with templates
look at what just happened with struts. no user inputs into templates or
error messages that may be appended to dom.

# Use explicit parameters instead of options object for functions

The language provides parameters, use them. Do not try and adopt a style less
intrinsic to the language.

# Maybe revert to IIFE syntax

The block scope syntax is strange. It requires global strict mode. Maybe
Move all 'use strict' out of global scope and into IIFE, similar to how
other libs do it. Or give up and switch to browserify and all that.

Delayed because it looks like modules are coming. Still not working in 61.

# Coding style

* No need for brackets for single line if statements
* Uppercase const declared variables that are in global scope
* No anonymous functions for better stack traces
* Use Smalltalk-style hungarian notation because javascript is dynamically
typed which sometimes causes confusion. For example, use "image_element" instead
of just "image". Use "url_object" or "url_string" instead of just "url". Only
use it when there is an ambiguity, and generally not in small functions where
the ambiguity can be quickly resolved and the declaration is probably still in
the reader's memory, or extremely apparent from how the variable is used.


# const for..of

https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of

Can use const instead of let e.g. (const var of iterator) ...

# Reconsider use of for..of due to current performance

See http://incaseofstairs.com/six-speed/ . For a basic array it is reportedly
17x slower. As cool as the new syntax is, it may not be worth it.

# Add support for &lt;picture&gt;

See https://googlechrome.github.io/samples/picture-element/

# Consider a single page application without an options page

* Consider moving the text size configuration from the options page to the
slideshow page. It is annoying to have to switch to options to change this. I
suppose this is based partly on how frequently the option is changed. It is also
a bit inconvenient because I want to immediately see the feedback of changing
the setting. This is done right now but the average user would have no idea
that it is possible. Probably need to add a menu bar component somehow to
slideshow.js. But I still want a minimal UI. So maybe this depends on some type
of auto-hide menu bar that appears only when hovering in a certain position on
the main page.

# TODO: Deprecate the feed title index

This was originally there so that I could load feed without having to explicitly
sort. This caused a lot of headache. I'd rather sort in the options page view.

Note this may have been done, this is just the text of an issue copied from an
old github issue.

# TODO: defer to chrome's favicon services

* Not certain but I might be able to use chrome://favicons service in an extension?
* It seems to require a permission?
* It looks like this is not reliable? only works for pages in history?
* For now I have rolled my own.
* It seems like Google does not want extensions to use the service.
* Then again there seems to be a changing api and now it is supported? Do not
have enough clear info
* Then again, I generally want to avoid deep browser reliance? Or should I just
give up on that.

# TODO: Add limits to string lengths in various places

Need to pay more attention to sanitization of inputs. For example, the maximum
length of an entry's link value should be something like 1024 characters. If it
is longer than that then the URL should be ignored, which will lead to the entry
not being stored. The only part that should be less 'bounded' is the content.
All other feed values and entry values coming in from outside input should be
more closely scrutinized.

# TODO: implement offline viewing of articles

Implement offline image viewing. One idea would be to download all images in a
document and encode them as data URIs in image src attributes. Then viewing a
document would not involve an online request per image.

An ancillary benefit would be that I could remove images that are bad, and I
could do other things to natively get an images size. I could also
modify/compress the blob.

Or, similarly, provide a CGI like script that involves an image cache. Create a
store in indexedDB for image blobs. Create a view page that yields the right
image somehow. Although maybe that is impossible, because requesting an html
page yields an html content type. Or maybe I just do not know enough about it
or there is another way to do it. Just noting the idea.

# TODO: Implement feed detection in visited pages

Probably involves a content script. I believe there is an extension out there that already does this, I could look at that as a guide on how to pass information around and provide a button in the address bar to click to subscribe. It should appear either on a page that is a feed, or when visiting an HTML page that contains a feed somewhere in its meta tags.

Review Google's RSS detection extension to look for some insights.

# TODO: recognize that some feeds eventually become invalid over time

Feeds go out of date, stop publishing new content, or just become unreachable.

Polling should determine if feeds are invalid after some time. Or maybe a separate
background task.

* add is-active feed functionality, do not poll in-active feeds
* deactivate unreachable feeds after x failures
* deactivate feeds not changed for a long time
* store deactivation reason in feed
* store deactivation date

# TODO: Merge multi-url pages into a single page

The idea is to investigate whether a page looks like it is spread over multiple pages, and if so, to get those other pages, merge them all together, and remove the paging elements

Because we will be fetching other pages, this will be async, so we will use a callback that is called when the whole op completes. Or a promise.

# TODO: Consider revising how articles are fetched and stored

Rather than simply storing entries, I should be somehow inserting entries into an unread queue, so that it is easy for the view to load entries in an order such as by most recently published, or from oldest or newest. Right now I am stuck with logical storage order, which is limiting. I would rather do this when polling than at the time of querying for articles to display, because it is too difficult to get the sorting of the articles to work correctly. Although maybe I could just ensure that every entries date published defaults to today, and then use an index on date published, read state, and archive state.

# TODO: Add a check for new articles button

The poll does not need to run exclusively on a schedule. Provide a way to "Check for new articles" from the UI.  Would also be cool to track progress

# TODO: Implement a main article image finder function

Should look at an article's content and return what is most likely the main image of the article.

* like the banner or whatever.
* this will help later if switching to a newspaper layout.

# TODO: Disallow file protocol and localhost domain

This applies to several areas

Do not allow subscribing to a feed with a url with file:// protocol
Do not allow subscribing to a feed with a url with localhost
Do not allow fetching of a url with either

# TODO: bug with tables

My general css styles for entries do not seem to properly be applying to
nested tables. Somehow the nested tables on default implicit properties trump
the explicit container properties that I assume should be inherited. I can try
ensuring that relevant table properties are set to inherit, or instead just
explicitly apply the entry properties to tables as well. Note it could be
cells (td) or tables (table), unsure.

# TODO: prohibit use of username:password in all requests?

# Article thumbnails

Would be neat to preview a screenshot of an article.

# Add a way to view articles that have been read (history)

Add a read articles history view

If I do this, the archiving of entries will need to retain additional information like date read and title and the entry's favicon
Do I revise the slideshow entirely so that it can just list articles and then the list can be switched from unread to read, or do I create an entirely separate page devoted to history.

need search ability similar to chrome history tab to view recently read articles

if integrated into main view, main view would need to be able to load recently read instead of unread

or a ui like apple's new news app

# Support basic browser features better in slideshow

* Support backward forward buttons (history and state)
* Support CTRL+Click
* Maybe support print mode somehow
* Support page refresh maybe
* Support bookmarking better (e.g. bookmark original article)
* Support sending link of current article somehow

# additional doc transform

Transform special big initial letter of article , change into normal letter.

See e.g. https://www.statnews.com/2017/09/05/watson-ibm-cancer/
