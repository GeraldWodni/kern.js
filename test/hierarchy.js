'use strict';

var hierarchy = require( "../hierarchy" );
var path    = require("path");

describe('hierarchy', function () {
    it('resolve www.wodni.at/css/index.less', function (done) {

        var websiteRoot = path.join( __dirname, "..", "websites" );
        var result = hierarchy.lookupFile( websiteRoot, "some.subdomains.kern", "css/index.less" );
        result.should.equal( path.join( websiteRoot, "kern", "css/index.less" ) );
        done();
    });
});
