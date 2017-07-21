# Overview

This is a collection of tips, insights, style preferences, and other notes about
writing Javascript code. I formed several of these opinions the hard way, by
making mistakes when programming.

# You're writing a book for both someone to read and some thing to process.

# Moderate your use of optimization. There is a balance to be struck.

# Use paragraphs to organize statements

# Avoid excessively qualifying an identifier when there is no ambiguity

When naming a variable within a function, you generally only need to worry about
conflation with other variables in the same function, or implied globals.
Therefore, there is no need to make the variable globally unique.

In a typeless language like Javascript, be wary of using incorporating the type
into the name when the type is implied from the variable's name. You can get
pretty far just by convention, or following a style guide. For example, when
working with a collection of things, like an array, use a plural word, such as
*things*. Do not use *arrayOfThings* or *thingsArray* or *thingArray*.

Do not call a list an array. Things like a NodeList or FileList are similar to,
but still fundamentally different from, arrays. You are simply going to cause
confusion later on because naming a thing an array leads the reader to believe
it is an array, when it is really something else.

When there is ambiguity, then consider qualifying the variable. For example,
Javascript added the URL object. This leads to several ambiguities when working
with urls. At any point you might be working with a URL object, or a String
object. In that case it makes sense to clearly say whether a url is an object
or a string by naming it urlObject versus urlString.

# Refactor one thing at a time

# Name parameters in preceding statements when calling functions to avoid relying
on memory of the API

# Do not use an object unless there is a need to encapsulate state

# Minimize the use of abbreviations in identifier names

# Appreciate the amount of code needed to even do a simple thing and avoid trying to cram everything into a small number of statements

# You do not get any points for being clever. In fact, quite the opposite.

# Break apart large functions into one master function and several helpers. The helpers should not be organized into a series of steps, but rather semantic abstractions around a purpose.

* The moment a function becomes larger than 30ish lines, it becomes difficult to track where variables are declared when using variables.
* It becomes harder to remember what the function is doing at each substep.
* It practically mandates the use of comments to help annotate the paragraphs, or sections of statements, within the function body, which is undesirable use of comments and does not take advantage of how function names can be self documenting.
* After this number of lines, using a typical text editor setup, you need to start scrolling back and forth from the midst of the function body to the top of its body, which is annoying.
* It promotes a subversive goal of trying to be concise and shrink the function body and fails to appreciate the scope of the function's task.

# Functions should encapsulate one or more statements with sufficient abstraction and not be overly transparent, but also not be misleading. Defining a function is like defining a verb in a custom language.

# Recognize the difference between (1) glue code specific to your program and (2) modular library code that is more specific to a platform on which your glue code operates as an extension of the language's built in library.

# Do not go too far/hard against the grain. Some languages want your code to work a certain way and do things a certain way.

# Not all syntax improvements are good improvements. Like default parameter values.

I think the language designers made a mistake here. This is an example of trying to make code more concise. The checks within the function body are clearer, and more explicit. I am not sure why someone tried to eliminate them, and for what benefit. The negatives outweigh the positives in this case. I would avoid the use of default parameter values.
