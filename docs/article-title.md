# article-title
Returns a new string where the publisher information has been stripped. For example, in the string "Florida man shoots self - Your Florida News", the algorithm would hopefully identify the publisher as "Your Florida news" and then return the string "Florida man shoots self" where the publisher has been filtered.

* If the input is bad, the input is returned unfiltered.
* If the publisher cannot be found, confidently, then then input is returned unfiltered.
* This is not a fancy algorithm. In fact it is really quite dumb. It is just something I cobbled together to get something remotely usable up and running. It does the job for now. It is generally rather conservative and just makes a few really dumb guesses.

## Params
* title {String}
* delims {Array} array of strings, delimiters (currently including spaces between the delimiter and other words)
* max_tail_words - if there are too many words after the delimiter then publisher is not filtered
* min_title_length - if the title has too few characters before or after filtering then publisher is not filtered
* min_publisher_length - if the publisher has too few characters then the publisher is not filtered
