# Overview

This is a collection of tips, insights, style preferences, and other notes about
writing Javascript code. I formed several of these opinions the hard way, by
making mistakes when programming.

# Code is written for two audiences: people and computers.

For reasons that are not entirely clear to me, programmers tend to
write dense, opaque code that makes clever use of syntax. I do not know this
trait's origin. It is as if there are virtual nerd points for playing code
golf, where the person to use fewer characters wins.

Perhaps it is a remnant of the old restrictions on source code file size from
the earliest days of computing.

Perhaps it is because code written for only a computer tends to be more
mathematical. Mathematicians prioritize rigor.

Perhaps programmers hate language. The whole left brain right brain thing.

Perhaps it is because some programmers simply hate prose. It is too verbose.
Verbose text is annoying to read because of the amount of time it takes to
consume the message. The extra amount of time it takes to digest the
message when filtering out the supporting information from the actual message.
Some feel that reading prose is inefficient. Programmers love efficiency.

This objective of writing only for a computer is very off target. This style of
code is difficult to interpret, difficult to maintain, and brittle.

I myself am guilty on numerous counts.

Code that is easy to interpret is not necessarily less performant. The idea that
shorter code performs better is a myth. An algorithm that describes its steps
more concisely and rigorously is no more efficient than one that uses prose.

I think newer programmers fail to realize that a program is much like a book.
Programs are intended to be read by other programmers. I would not go as far
as to advocate or literate programming, as some amount of sophistication can
be expected. Instead of file size, the objective should be organization, and
clear communication.  Like a book, a program sends a message to the reader.
That message should be easy to understand. That message should be accurate.

Like writing a book, programs require drafts. It takes time and care to write
a program that is easy to understand. Care must be taken when naming variables
and functions. Writing well is not easy, even for the most masterful of
programmers.

To me, beautiful code is code that is simple to understand, accurately portrays
its purpose, is suited to the job it is trying to do, is well organized, follows
some set of conventions, and is consistent.

Beautiful code may be difficult to refactor. I have no qualm with that. Real
world problems are complex, unique, and require customization.

So remember, you are an author. And, if the amount of utter crap programs found
on the Internet is any clue, a rather shitty author. Your objective is
to write an educational treatise, not a clever short story.

Do not simply solve the immediate problem before you. Document your work, so
that when the problem changes, as it inevitably does, you have a guide and
can speedily move along.

When writing code for a person, think about some of the same issues faced by an
author writing a book. In fact, go and learn about how to become a good writer.
It will make you a better programmer. Your colleagues, and your future self,
will despise you less.

# Optimize in moderation

There is a balance to be struck between a completely naive and unoptimized
approach to solving a problem and an extremely-carefully over-architected
solution.

Certain optimizations are good. For example, using the appropriate data
structure is good. Some of this has to do with knowing how programming code
is translated later into machine code, which is admittedly somewhat difficult
to understand. But something like using an array in place of a list is better
in many cases. This type of care should be paid during initial design.

But many, if not most, optimizations are bad. Writing code that performs well is
less important than writing code that is easy to understand.

Once a program is laid out and well-organized, *then* it is time to optimize.
And then, only the hotspots. Use profile-guided optimization.

Here is some low hanging fruit. A function that runs very rarely, or only once,
really does not need to be optimized. A rarely called function is not a hotspot.

Basically, any time you are relying on your gut and not doing profile driven
optimization, there should be an element of doubt.

Real world problems are subject to dynamic conditions. Resilient programs can
adapt to new requirements. Be wary of designing a very fast car if soon there
may not be roads.

Optimized code tends to be more difficult to understand. It tends to be more
concise, written by more experienced developers who assume quite a lot of the
reader and who tend to avoid comments. This is one reason to approach
optimization with some reservation.

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

# Code is commentary, and commentary is code

# A program is not complete or well written until it is simple to read
