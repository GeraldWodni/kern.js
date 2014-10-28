// navigation administration module
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var bcrypt      = require("bcrypt-nodejs");
var colors      = require("colors");
var util        = require("util");
var querystring = require("querystring");


module.exports = {
    setup: function( k ) {


    /* TODO: navigation: as simple as possible, just use LINK:FILE pairs, all LINKS open a jade file, which can in turn call views. If needed, you can also configure for special acion */
    /* TODO: keep track of all websites in redis */

        n = {
            "/":        { name: "Home", file: "home" },
            "/users":   { name: "Users", file: "users" }
        };


        /* enable crud */
        k.rdb.crud.router( k, ["/", "/edit/:link"], k.rdb.navigation, {
            id: "link",
            readFields: function ( req ) {
                return {
                    name: req.postman.fields["name"],
                    link: req.postman.link(),
                    type: req.postman.alnum( "type" ),
                    target: req.postman.alnum( "target" )
                }
            }
        });

        function renderAll( req, res, values ) {
            console.log("Render All", values);
            k.rdb.navigation.readAll( req.website, function( err, items ) {
                if( err )
                    next( err );
                    
                items.forEach( function( item ) {
                    item.escapedLink = encodeURIComponent( item.link );
                });
            
                console.log( "RENDER".red.bold );
                /* TODO: generic non-JS version */
                k.renderJade( req, res, "admin/navigation", { messages: req.messages, items: items, values: values } );
            });
        }

        k.router.get( "/edit/:link?", function( req, res ) {
            k.rdb.navigation.read(req.website, req.requestData.escapedLink( 'link' ), function( err, data ) {
                if( err )
                    next( err );

                renderAll( req, res, data );
            });
        });

        k.router.get( "/", function( req, res ) {
            renderAll( req, res );
        });
    }
};
