(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
define("npm:jquery", function() {return { "default": require("jquery") };});
define("npm:moment", function() {return { "default": require("moment") };});
define("npm:moment/lib/ago", function() {return { "default": require("moment/lib/ago") };});
},{"jquery":2,"moment":3,"moment/lib/ago":4}],2:[function(require,module,exports){
module.exports = 'THAT KNOCKS';
},{}],3:[function(require,module,exports){
var ago = require('./lib/ago');
var time = require('./lib/time');

module.exports = {'ago': ago, 'time': time};
},{"./lib/ago":4,"./lib/time":5}],4:[function(require,module,exports){
module.exports = { foo: 'ago'};
},{}],5:[function(require,module,exports){
module.exports = {
  time: 'time'
};
},{}]},{},[1]);
