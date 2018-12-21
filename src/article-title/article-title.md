Returns a new string where the publisher information has been stripped. For example, in the string "Florida man shoots self - Your Florida News", the algorithm would hopefully identify the publisher as "Your Florida news" and then return the string "Florida man shoots self" where the publisher has been filtered.

If the input is bad, the input is returned unfiltered.

If the publisher cannot be found, confidently, then then input is returned unfiltered.

This is not a fancy algorithm. In fact it is really quite dumb. It is just something I cobbled together to get something remotely usable up and running. It does the job for now. It is generally rather conservative and just makes a few really dumb guesses.

## Params
* title {String}
* delims {Array} array of strings, delimiters (currently including spaces between the delimiter and other words)
* max_tail_words - if there are too many words after the delimiter then publisher is not filtered
* min_title_length - if the title has too few characters before or after filtering then publisher is not filtered
* min_publisher_length - if the publisher has too few characters then the publisher is not filtered

## Misc notes

If I ever have the time and enthusiasm it would be fun to research a smarter algorithm. There are obvious constraints, one being that it must be written in JavaScript, and it must be shallow so that it remains fast. Speed and simplicity is more important than accuracy in this case.

One idea would be to start development of a testing dataset. I think I would try would be to create a json file, and invent my own format, where I store hundreds or thousands of article titles in an array of objects. For each object I store the publisher value, and the expected return value. Then I could experiment with different models and evaluate their accuracy.

## TODO:
* add more tests, e.g. test using additional parameters where other parameters are not the default values
* maybe should tolerate other whitespace than exactly ascii 32 around delims, actually should probably do an actual split by words tokenization so that the original spacing becomes irrelevant. we are tokenizing later after all. it would make more sense to tokenize first, then iterate over tokens and find the delimiter token.