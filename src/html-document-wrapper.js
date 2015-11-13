// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: invent a better name, e.g. WHTMLDocument ?
// TODO: learn why I have having issues extending HTMLDocument

class HTMLDocumentWrapper {

  constructor(document) {
    this.document = document;
  }

  get body() {
  	return this.document.body;
  }

  get documentElement() {
  	return this.document.documentElement;
  }

  static wrap(document) {
  	return new HTMLDocumentWrapper(document);
  }

  appendChild(node) {
    this.document.appendChild(node);
  }

  createElement(name) {
  	return this.document.createElement(name);
  }

  getElementsByClassName(query) {
  	return new NodeListWrapper(this.document.getElementsByClassName(query));
  }

  getElementsByTagName(query) {
  	return new NodeListWrapper(this.document.getElementsByTagName(query));
  }

  querySelectorAll(selector) {
    return new NodeListWrapper(this.document.querySelectorAll(selector));
  }

  querySelector(selector) {
  	return this.document.querySelector(selector);
  }

  createNodeIterator(node, nodeFilter) {
  	return this.document.createNodeIterator(node, nodeFilter);
  }

  forEachNode(nodeFilter, callback) {
  	const root = this.document.documentElement;
  	const iterator = this.document.createNodeIterator(root, nodeFilter);
  	for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
  	  callback(node);
  	}
  }
}

// Private helper for document wrapper
// NOTE: also applies to HTMLCollection, not just NodeList
// TODO: extend NodeList?

class NodeListWrapper {
  constructor(list) {
  	this.list = list;
  }

  get internal() {
    return this.list;
  }

  get length() {
    return this.list.length;
  }

  filter(callback) {
  	return Array.prototype.filter.call(this.list, callback);
  }

  forEach(callback) {
  	Array.prototype.forEach.call(this.list, callback);
  }

  reduce(callback, initialValue) {
  	return Array.prototype.reduce.call(this.list, callback, initialValue);
  }
}
