// editor administration module
// (c)copyright 2017 by Gerald Wodni <gerald.wodni@gmail.com>

var bcrypt      = require("bcrypt-nodejs");
var colors      = require("colors");
var util        = require("util");
var querystring = require("querystring");
var _           = require("underscore");

module.exports = {
    setup: function( k ) {

        var hierarchyFilters = {
            dirShowFilters:  [ /views/g, /css/g, /js/g, /^$|^\/admin\/editor\/edit$/g ],
            fileShowFilters: [ /.*\.css$/g, /.*\.jade$/g, /.*\.js$/g, /.*\.jsxon$/, /.*\.less$/g, /.*\.md$/g ],
            lockWebsite: true
        };

        k.router.get("/edit/*", function( req, res ) {
            var filename = req.params[0];
            if( !k.hierarchy.checkFilters( req.kern.website, filename, hierarchyFilters ) )
                return k.httpStatus( req, res, 403 );
            k.hierarchy.createReadStream( req.kern.website, filename ).pipe( res );
        });

        k.router.get( "/", function( req, res ) {
            k.hierarchy.readHierarchyTree( req.kern.website, ".", _.extend( {}, hierarchyFilters, {
                prefix: "/admin/editor/edit"
            }),
            function( err, tree ) {
                k.jade.render( req, res, "admin/editor", { tree: tree } );
            });
        });
    }
};
