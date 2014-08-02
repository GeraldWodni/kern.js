// administration utility
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var bcrypt  = require("bcrypt-nodejs");
var colors  = require("colors");
var util    = require("util");


module.exports = {
    setup: function( k ) {

        k.router.use( k.rdb.users.loginRequired( "admin/login" ) );

        k.router.get( "/navigation", function( req, res ) {
            k.renderJade( req, res, "admin/navigation" );
        });


        k.router.use( "/locales", k.siteModule( "./" + k.modules.hierarchy.lookupFile( k.kernOpts.websitesRoot, "default", "missingLocales.js" ) ).router );

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
            console.log( util.inspect( req ) );
        });

    }
};
