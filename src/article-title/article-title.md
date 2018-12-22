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

## Impl notes on tolerating bad input
Postel's law. https://en.wikipedia.org/wiki/Robustness_principle. Basically, be liberal in what you accept and strict in what you produce. Or, in other words, tolerate various bad or poorly defined inputs to some degree, but consistently return the same well-defined type of value and carry out the same type of behavior (e.g. aim for determinism, so that you follow the principle of least astonishment, and promote certainty in the transactional sense, e.g. each time you interact with this function and use it, it works like what you would expect, and your chances of making a mistake are reduced). This law is controversial in that there are pros and cons and different people with vehement opinions.

There is a similar concept I refer to as caller convenience, where your API, which is basically the public functions of the module and each function's parameters and return value and stated errors, tries to reduce the amount of work a caller has to do before using the module. In this case we are basically talking about the one public function of this module. Tolerating bad input means the caller does not have to do the extra sanity checks and guards and deal with all the paranoia/anxiety/uncertainty before calling the function. That's nice. However, it leads to laziness, and inconsistent call patterns, and a bit of ambiguity, and possibly wasted processing (e.g. it increases the chance you hardcode in a suboptimal execution path that always does more work than needed and would have been avoided if you had just done a little more preprocessing and exercised more care and perhaps if you knew to do so because the docs and the function signature properly and clearly prompted you so you could properly anticipate the function's behavior). It is one of those subjective things in programming.

This whole app is an experiment to flesh out these little problems and just sit back and think about them. This whole app is partly just an excuse to write about such concepts more concretely, to experience them instead of just read about them. So I am demonstrating both implementations here and in comparison in other modules in the app that are more strict. I just want to write it out, and watch it, and return to it later, and feel it, and get a real sense of whether it is good or bad.

## Misc notes

If I ever have the time and enthusiasm it would be fun to research a smarter algorithm. There are obvious constraints, one being that it must be written in JavaScript, and it must be shallow so that it remains fast. Speed and simplicity is more important than accuracy in this case.

One idea would be to start development of a testing dataset. I think I would try would be to create a json file, and invent my own format, where I store hundreds or thousands of article titles in an array of objects. For each object I store the publisher value, and the expected return value. Then I could experiment with different models and evaluate their accuracy.

## TODO:
* add more tests, e.g. test using additional parameters where other parameters are not the default values
* maybe should tolerate other whitespace than exactly ascii 32 around delims, actually should probably do an actual split by words tokenization so that the original spacing becomes irrelevant. we are tokenizing later after all. it would make more sense to tokenize first, then iterate over tokens and find the delimiter token.
