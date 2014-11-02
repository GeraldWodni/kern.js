// administration utility
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var express = require("express");
var bcrypt  = require("bcrypt-nodejs");
var colors  = require("colors");
var util    = require("util");
var _       = require("underscore");

/* methods */
var addSiteModule;
var menu;

var allowed = function( req, link ) {
    var permissions = ( req.user || {} ).permissions || "";
    return permissions.indexOf( link ) >= 0;
};

var viewValues = function( req, values ) {
    return _.extend( { menu: menu( req ) }, values || {} );
};

module.exports = {
    setup: function( k ) {

        var subModules = {
            early:  { router: express.Router(), menu: [] },
            main:   { router: express.Router(), menu: [] },
            admin:  { router: express.Router(), menu: [] },
            late:   { router: express.Router(), menu: [] },
            final:  { router: express.Router(), menu: [] }
        };

        /* login & permission-wall */
        k.router.use( k.rdb.users.loginRequired( "admin/login" ) );
        k.router.use( function( req, res, next ) {
            if( allowed( req, req.path.split( "/" )[1] || "" ) )
                next();
            else
                k.renderJade( req, res, "admin/accessDenied" );
        } );

        /* assemble and translate menu */
        menu = function( req ) {

            var modules = _.union( subModules.early.menu, subModules.main.menu, subModules.admin.menu, subModules.late.menu, subModules.final.menu );
            console.log( "MENU".green.bold, modules );
            var menuItems = _.map( modules, function( module ) {
                return _.extend( module, {
                    name: module.english != "" ? req.locales.__( module.english ) : ""
                });
            });

            return _.filter( menuItems, function( item ) {
                return allowed( req, item.link );
            } );
        };

        /* add site modules */
        addSiteModule = function( link, website, filename, name, glyph, opts ) {
            console.log( "addSiteModule".magenta.bold, link, name );
    
            opts = opts || {};
            var subRouter = subModules[ opts.router || "main" ].router;
            var subMenu = subModules[ opts.menu || opts.router || "main" ].menu;
            var target;
            /* function passed directly */
            if( typeof filename === "function" )
                target = filename;
            else 
                target = k.siteModule( website, filename, opts ).router;

            subRouter.use( "/" + link, target );
            subMenu.push( { link: link, glyph: glyph, english: name } );
            console.log( subMenu );
        };

        /* main admin modules */
        /* TODO: is website really required? won't it be "default" always? */
        addSiteModule( "navigation","default", "navigation.js",     "Navigation",   "list",     { router: "admin" } );
        addSiteModule( "users",     "default", "users.js",          "Users",        "user",     { router: "admin" } );
        addSiteModule( "locales",   "default", "missingLocales.js", "",             "comment",  { router: "admin" } );

        /* TODO: write media upload & explore-tool */
        //addSiteModule( "media", "default", "media.js", "Media", "folde-open" );

        /* logout function */
        addSiteModule( "logout", "default", function( req, res ) {
            req.sessionInterface.destroy( req, res, function() {
                k.renderJade( req, res, "admin/logout" );
            });
        }, "Logout", "log-out", { router: "late" } );

        /* manual info (first item, last match) */
        addSiteModule( "", "default", function( req, res ) {
            k.renderJade( req, res, "admin/info", viewValues( req ) );
        }, "Info", "info-sign", { router: "final", menu: "early" } );

        /* use Addside-modules */
        k.router.use( subModules.early.router  );
        k.router.use( subModules.main.router   );
        k.router.use( subModules.admin.router  );
        k.router.use( subModules.late.router   );
        k.router.use( subModules.final.router  );

        k.router.use( function( req, res ) {
            console.log( "Done".green.bold );
            res.end( "DONE\n\n" );
            //console.log( util.inspect( req ) );
        });

    },
    values: viewValues,
    allowed: allowed,
    addSiteModule: function() {
        addSiteModule.apply( this, arguments );
    }
};
