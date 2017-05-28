/* eslint-env node, mocha */
var chai = require('chai');
var index = require('../index.js');
var sinon = require('sinon');
var fs = require('fs');

describe('FlickrApi tests', function() {
    describe('Filter ids to download', function() {
        beforeEach(function (done) {            
            done();
        });

        afterEach(function (done) {            
            done();
        });
        var ids = ['1','2','3'];
        var idsResult = ['1','3'];
        it('should return the correct ids to download', function() {
            sinon.stub(fs,'readdir').callsFake(function (path, callback) {
                callback(null, ['2.jpg']);
            });
            return index.getPhotosToDownload(ids).then(function(result){                
                chai.expect(result).to.deep.equal(idsResult);  
            });                   
        });
    });
});
