// administration utility
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var bcrypt  = require("bcrypt-nodejs");
var colors  = require("colors");
var util    = require("util");
var _       = require("underscore");

var allowed = function( req, link ) {
    var permissions = ( req.user || {} ).permissions || "";
    return permissions.indexOf( link ) >= 0;
};

var menu = function( req ) {
    var menuItems = [
        { link: "",           glyph: "info-sign",    name: req.locales.__("Info"      ) },
        { link: "navigation", glyph: "list",         name: req.locales.__("Navigation") },
        { link: "media",      glyph: "folder-open",  name: req.locales.__("Media"     ) },
        { link: "users",      glyph: "user",         name: req.locales.__("Users"     ) },
        { link: "locales",    glyph: "comment",      name: ""                           },
        { link: "logout",     glyph: "log-out",      name: req.locales.__("Logout"    ) }
    ];

    return _.filter( menuItems, function( item ) {
        return allowed( req, item.link );
    } );
};

var viewValues = function( req, values ) {
    return _.extend( { menu: menu( req ) }, values || {} );
};

module.exports = {
    setup: function( k ) {

        k.router.use( k.rdb.users.loginRequired( "admin/login" ) );
        k.router.use( function( req, res, next ) {
            if( allowed( req, req.path.substring( 1 ) ) )
                next();
            else
                //next();
                k.renderJade( req, res, "admin/accessDenied" );
        } );

        k.useSiteModule( "/navigation", "default", "navigation.js" );
        k.useSiteModule( "/locales",    "default", "missingLocales.js" );
        k.useSiteModule( "/users",      "default", "users.js" );

        k.router.get( "/logout", function( req, res ) {
            req.sessionInterface.destroy( req, res, function() {
                k.renderJade( req, res, "admin/logout" );
            });
        });

        k.router.get( "/", function( req, res ) {
            k.renderJade( req, res, "admin/info", viewValues( req ) );
        });

        k.router.use( function( req, res ) {
            console.log( "Done".green.bold );
            res.end( "DONE\n\n" );
            //console.log( util.inspect( req ) );
        });

    },
    values: viewValues,
    allowed: allowed
};
