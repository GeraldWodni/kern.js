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
        k.router.post("/", function( req, res, next ) {
            console.log( "POST-ALL".red.bold ); 
            next();
        });

        //k.router.get( "/item/:link", function( req, res, next ) {
        k.router.get( "/item", function( req, res, next ) {
            res.send( "OKAY!");

            //k.rdb.navigation.read( req.website, req.filters.linkPart( req.param.link ), function( err, item ) {
            //    if( err )
            //        next( err );

            //    res.send( item );
            //});
        } );

        function readFields( req ) {
            return {
                name: req.postman.fields["name"],
                link: req.postman.link(),
                type: req.postman.alnum( "type" ),
                target: req.postman.alnum( "target" )
            }
        };

        k.router.post( "/", function( req, res, next ) {
            console.log( "POSTY".red.bold ); 

            k.modules.postman( req, res, function() {

                if( req.postman.exists( "add" ) ) {
                    var obj = readFields( req );

                    k.rdb.navigation.create( req.website, obj.link, obj, function( err ) {
                        if( err )
                            return next( err );

                        req.messages.push( { type: "success", title: req.locales.__("Success"), text: req.locales.__("Item added") } );

                        console.log( "SAVED".red.bold );
                        req.method = "GET";
                        return next();
                    });
                }
                /* TODO: replace there exists queries by methodOverride */
                /* TODO: make CRUD generic */
                else if( req.postman.exists( "update" ) ) {

                }
                else {
                    console.log( "HMMMM".red.bold );
                    next();
                }
            });
        });






        k.router.get( "/all",   function( req, res, next ) { 
                k.rdb.navigation.readAll( k.website, function( err, data ) {
                        console.log( err );
                        if( err )
                                return next( err );
                        res.send( data );
                });
        });

        k.router.get( "/asd",   function( req, res ) { k.renderJade( req, res, "admin/info" ); } );

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

        k.router.post( "/edit/:id", function( req, res, next ) {
            k.modules.postman( req, res, function() {

                var id = req.requestData.escapedLink( 'id' );
                if( req.postman.exists( "delete" ) ) {

                    k.rdb.navigation.del( req.website, id, function( err ) {
                        if( err )
                            return next( err );

                        req.messages.push( { type: "success", title: req.locales.__("Success"), text: req.locales.__("Item deleted") } );

                        console.log( "DELETED".red.bold );
                        req.method = "GET";
                        return next();
                    });
                }
                else if( req.postman.exists( "update" ) ) {
                    var obj = readFields( req );
                    k.rdb.navigation.update( req.website, id, obj.link, obj, function( err ) {
                        if( err )
                            return next( err );

                        req.messages.push( { type: "success", title: req.locales.__("Success"), text: req.locales.__("Item updated") } );

                        console.log( "UPDATED".red.bold );
                        req.method = "GET";
                        return next();
                    });
                }
                else {
                    console.log( "HMMMM?".red.bold );
                    next();
                }
            });
        });

        k.router.get( "/edit/:link?", function( req, res ) {
            console.log( "ASD:", req.requestData.escapedLink( 'link' ) );
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
