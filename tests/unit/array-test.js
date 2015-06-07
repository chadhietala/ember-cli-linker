'use strict';

var array = require('../../lib/utils/array');
var expect = require('chai').expect;

describe('array', function() {
  describe('zip', function() {
    it('creates a an array tubples zipped togeather', function() {
      expect(array.zip([1,2,3], [4,5,6])).to.deep.eql([[1,4], [2,5], [3,6]]);
    }); 
  });

  describe('uniq', function() {
    it('dedupes arrays', function() {
      expect(array.uniq([1,2,3,4,1,2,3,4])).to.deep.eql([1,2,3,4]);
    });
  });

  describe('equal', function() {
    it('should be false if length is different', function() {
      expect(array.equal([1,2], [1])).to.eql(false);
    });
    
    it('should be false if either are null', function() {
      expect(array.equal([1,2], null)).to.eql(false);
    });

    it('should be false if order does not match', function() {
      expect(array.equal([1,2], [2,1])).to.eql(false);
    });

    it('should be true if contents are the same and in order', function() {
      expect(array.equal([1,2], [1,2])).to.eql(true);
    });
  });

  describe('compact', function() {
    it('should remove all falsy values', function() {
      expect(array.compact([1, 2, null, undefined, -1])).to.deep.eql([1,2, -1]);
    });
  });

  describe('contains', function() {
    it('should return true if the item is in the array', function() {
      expect(array.contains([1,2,3], 1)).to.eql(true);
    });

    it('should return false if the item is in the array', function() {
      expect(array.contains([1,2,3], 5)).to.eql(false);
    });
  });

  describe('flatten', function() {
    it('should flatten a 2d array', function() {
      expect(array.flatten([[1], [2], [3]])).to.deep.eql([1,2,3]);
    });
  });

  describe('without', function() {
    it('should return an array without the values specified', function() {
      var exclude = [2,3];
      expect(array.without([1,2,3], exclude)).to.deep.eql([1]);
    });
  });

  describe('intersect', function() {
    it('should return the intersection of 2 arrays', function() {
      expect(array.intersect([1,2,3], [1,4,5])).to.deep.eql([1]);
    });
  });

  describe('head', function() {
    it('should return the head of the array', function() {
      expect(array.head([1,2,3])).to.deep.eql(1);
    });
  });
});