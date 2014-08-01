// administration utility
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var bcrypt  = require("bcrypt-nodejs");
var colors  = require("colors");

module.exports = {
    setup: function( k ) {

        k.router.use( k.rdb.users.loginRequired( "admin/login" ) );

        k.router.get( "/logout", function( req, res ) {
            req.sessionInterface.destroy( req, res, function() {
                k.renderJade( res, req.kern.website, "admin/logout", {} );
            });
        });

        k.router.get( "/", function( req, res ) {
            k.renderJade( res, req.kern.website, "admin/info", {} );
        });

        /* TODO: remove this and change method from POST to GET upon successfull login */
        //k.router.post( "/", function( req, res ) {
        //    console.log( "POST admin".red.bold );
        //    req.kern.renderJade( res, "kern", "no-config" );
        //});

        k.router.use( function( req, res ) {
            console.log( "Done".green.bold );
            res.end( "DONE" );
            console.log( JSON.stringify( req ) );
            }
        );

    }
};
