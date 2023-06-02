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
            k.rdb.navigation.readAll( req.kern.website, async function( err, items ) {
                if( err )
                    next( err );
                    
                items.forEach( function( item ) {
                    item.escapedLink = encodeURIComponent( item.link );
                });
            
                /* TODO: generic non-JS version */
                k.renderJade( req, res, "admin/navigation", await k.reg("admin").pValues( req, { messages: req.messages, items: items, values: values } ) );
            });
        }

        k.router.get( "/edit/:link?", function( req, res ) {
            k.rdb.navigation.read(req.kern.website, req.requestData.escapedLink( 'link' ), function( err, data ) {
                if( err )
                    return next( err );

                data.escapedLink = encodeURIComponent( data.link );
                renderAll( req, res, data );
            });
        });

        k.router.get( "/", function( req, res ) {
            renderAll( req, res );
        });
    }
};
