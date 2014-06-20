'use strict';

var hierarchy = require( "../hierarchy" );
var path    = require("path");

function testEquals( result, expected ) {
    result.should.equal( expected );
}

describe('hierarchy', function () {

    /* todo: create test environment for tests */
    var websitesRoot = path.join( __dirname, "..", "websites" );

    it('resolve to kern', function (done) {

    	function testHierarchy( root, website, dir, expectedWebsite, expectedPath ) {
            testEquals( hierarchy.lookupFile( root, website, dir ), path.join( root, expectedWebsite, dir ) );
	}

	testHierarchy( websitesRoot, "some.subdomains.kern", "css/index.less", "kern" );
	testHierarchy( websitesRoot, "kern", "css/index.less", "kern" );
        done();
    });

    it('up', function(done) {
        hierarchy.up( "www.wodni.at" ).should.equal( "wodni.at" );
        hierarchy.up( ".at" ).should.equal( "at" );
        hierarchy.up( "at" ).should.equal( "default" );
        ( hierarchy.up( "default" ) === null ).should.be.true;

        done();
    });

    it('upExists', function(done) {
        hierarchy.upExists( websitesRoot, "www.wodni.at" ).should.equal( "default" );
        ( hierarchy.upExists( websitesRoot, "default" ) === null ).should.be.true;

        done();
    });

    it('paths', function(done) {
        hierarchy.paths( websitesRoot, "www.wodni.at" ).should.equal( "default" );

        done();
    });
});
