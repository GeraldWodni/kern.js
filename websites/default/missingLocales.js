// extend locales by replacing the missing texts from rdb into the json-files
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var fs      = require("fs");
var path    = require("path");
var _       = require("underscore");

module.exports = {
    setup: function( k ) {

        function addText( locale, key, text, next ) {
            var filename = path.join( "locales", locale + ".json" );

            fs.readFile( filename, function( err, content ) {
                if( err )
                    return next( err );

                var obj = JSON.parse( content );
                obj[ key ] = text;
                content = JSON.stringify( obj, null, 4 );
                
                fs.writeFile( filename, content, function( err ) {
                    next( err );
                });
            });
        }

        k.router.post( "/", function( req, res, next ) {
            k.modules.postman( req, res, function() {
                console.log( req.postman.fields );

                if( req.postman.exists( "reset" ) ) {
                    k.rdb.del( "missing-locales", next );
                    return;
                }

                /* TODO: create postman.each or alike interface */
                var name = req.postman.fields.key;
                var fields = req.postman.fields.text;
                var remaining = _.keys( fields ).length;

                /* write all fields */
                _.each( fields, function( value, key ) {
                    addText( key, name, value, function( err ) {
                        if( err )
                            next( err );

                        if( --remaining == 0 ) {
                            k.rdb.srem( "missing-locales", name, function( err ) {

                                /* update written locales to avoid new entry in redis */
                                req.locales.reload();
                                req.method = "GET";
                                next( err );
                            });
                        }
                    });
                });
            });
        });

        k.router.get( "/", function( req, res, next ) {
            k.rdb.smembers( "missing-locales", function( err, members ) {
                if( err )
                    return next( err );

                k.renderJade( req, res, "admin/missingLocales", k.reg("admin").values( req, { members: members, locales: req.locales.available } ) );
            });
        });
    }
};
