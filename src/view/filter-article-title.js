function filter_article_title(title) {
  'use strict';
  let index = title.lastIndexOf(' - ');
  if(index === -1)
    index = title.lastIndexOf(' | ');
  if(index === -1)
    index = title.lastIndexOf(' : ');
  if(index === -1)
    return title;

  // todo: should this be +3 given the spaces wrapping the delim?
  // TODO: maybe this should be a call to a helper about getting words array
  const tail_string = title.substring(index + 1);
  const tail_words = tail_string.split(/\s+/g);
  const non_empty_tail_words = tail_words.filter((w) => w);
  let output_title;
  if(non_empty_tail_words.length < 5) {
    output_title = title.substring(0, index);
    output_title = output_title.trim();
  } else {
    output_title = title;
  }
  return output_title;
}
