'use strict';

var should = require( "should" );

var hierarchy = require( "../hierarchy" );
var path    = require("path");

function testEquals( result, expected ) {
    result.should.equal( expected );
}

describe('hierarchy', function () {

    /* todo: create test environment for tests */
    var websitesRoot = path.join( __dirname, "websites" );

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
        hierarchy.upExists( websitesRoot, "www.wodni.at" ).should.equal( "wodni.at" );
        hierarchy.upExists( websitesRoot, "something.unknown.at" ).should.equal( "default" );
        ( hierarchy.upExists( websitesRoot, "default" ) === null ).should.be.true;

        done();
    });

    it('paths', function(done) {
        should( hierarchy.paths( websitesRoot, "www.wodni.at", "css" ) ).eql([
            path.join( websitesRoot, "wodni.at/css" ),
            path.join( websitesRoot, "default/css" )
	]);

        should( hierarchy.paths( websitesRoot, "www.wodni.at", "css" ) ).not.eql([
            path.join( websitesRoot, "wodni.at/css" ),
            path.join( websitesRoot, "at/css" ),
            path.join( websitesRoot, "default/css" )
	]);

        done();
    });

    it('routes', function(done) {
        hierarchy.addRoute( "wodni.at", "kern");
        hierarchy.upExists( websitesRoot, "wodni.at" ).should.equal( "kern" );
        should( hierarchy.paths( websitesRoot, "www.wodni.at", "css" ) ).eql([
            path.join( websitesRoot, "wodni.at/css" ),
            path.join( websitesRoot, "kern/css" ),
            path.join( websitesRoot, "default/css" )
	]);
        hierarchy.lookupFile( websitesRoot, "www.wodni.at", "css/default.less" ).should.equal( path.join( websitesRoot, "default", "css/default.less" ));
        hierarchy.lookupFile( websitesRoot, "www.wodni.at", "css/index.less" ).should.equal( path.join( websitesRoot, "kern", "css/index.less" ));
        hierarchy.lookupFile( websitesRoot, "www.wodni.at", "kern.js" ).should.equal( path.join( websitesRoot, "kern", "kern.js" ));
        done();
    });
});
