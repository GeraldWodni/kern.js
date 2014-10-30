// administration utility
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var bcrypt  = require("bcrypt-nodejs");
var colors  = require("colors");
var util    = require("util");


module.exports = {
    setup: function( k ) {

        k.router.use( k.rdb.users.loginRequired( "admin/login" ) );

        k.useSiteModule( "/navigation", "default", "navigation.js" );
        k.useSiteModule( "/locales",    "default", "missingLocales.js" );
        k.useSiteModule( "/users",      "default", "users.js" );

        k.router.get( "/logout", function( req, res ) {
            req.sessionInterface.destroy( req, res, function() {
                k.renderJade( req, res, "admin/logout" );
            });
        });

        k.router.get( "/", function( req, res ) {
            k.renderJade( req, res, "admin/info" );
        });

        k.router.use( function( req, res ) {
            console.log( "Done".green.bold );
            res.end( "DONE\n\n" );
            //console.log( util.inspect( req ) );
        });

    }
};
