Returns a new string where the publisher information has been stripped. For example, in the string "Florida man shoots self - Your Florida News", the algorithm would hopefully identify the publisher as "Your Florida news" and then return the string "Florida man shoots self" where the publisher has been filtered.

If the input is bad, the input is returned unfiltered.

If the publisher cannot be found, confidently, then then input is returned unfiltered.

This is not a fancy algorithm. In fact it is really quite dumb. It is just something I cobbled together to get something remotely usable up and running. It does the job for now. It is generally rather conservative and just makes a few really dumb guesses.

## Misc notes

If I ever have the time and enthusiasm it would be fun to research a smarter algorithm. There are obvious constraints, one being that it must be written in JavaScript, and it must be shallow so that it remains fast. Speed and simplicity is more important than accuracy in this case.

One idea would be to start development of a testing dataset. I think I would try would be to create a json file, and invent my own format, where I store hundreds or thousands of article titles in an array of objects. For each object I store the publisher value, and the expected return value. Then I could experiment with different models and evaluate their accuracy.

## TODO:
* add more tests, e.g. test using additional parameters where other parameters are not the default values
