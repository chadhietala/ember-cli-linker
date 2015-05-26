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
});