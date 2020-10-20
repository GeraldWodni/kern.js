// administration utility
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var express   = require("express");
var bcrypt    = require("bcrypt-nodejs");
var colors    = require("colors");
var util      = require("util");
var _         = require("underscore");

/* methods */
var addSiteModule;
var addPermissionType;
var menu;

var allowed = function( req, link ) {
    var permissions = ( req.user || {} ).permissions || "";
    return permissions.indexOf( link ) >= 0;
};

var getField;
const valueCallbacks = {};
function addValuesCallback( website, callback ) {
    console.log( "ADD VALUE CALLback", website );
    if( !_.isArray( valueCallbacks[ website ] ) )
        valueCallbacks[ website ] = [ callback ];
    else
        valueCallbacks[ website ].push( callback );
}
function viewValues( req, values ) {
    values = values || {};
    if( _.isObject( req.adminValues ) )
        values = _.extend( req.adminValues, values );

    if( valueCallbacks.hasOwnProperty( req.kern.website ) )
        valueCallbacks[ req.kern.website ].forEach( callback => callback( req, values ) );

    return _.extend( { menu: menu( req ), getField: getField, userIsLoggedIn: typeof( req.user ) !== "undefined" }, values );
};

module.exports = {
    setup: function( k ) {

        var subModules = {};
        getField = k.rdb.getField;

        function websiteSubmodules( website ) {
            var routers = {
                early:  { router: k.newRouter(), menu: [] },
                main:   { router: k.newRouter(), menu: [] },
                admin:  { router: k.newRouter(), menu: [] },
                late:   { router: k.newRouter(), menu: [] },
                final:  { router: k.newRouter(), menu: [] },
                permissionTypes: []
            };
            subModules[ website ] = routers;
        };

        /* login & permission-wall */
        k.router.use( k.users.loginRequired( "admin/login", { noUserRegistration: true } ) );
        k.router.use( function( req, res, next ) {
            if( allowed( req, req.path.split( "/" )[1] || "" ) )
                next();
            else
                k.jade.render( req, res, "admin/accessDenied" );
        } );

        /* assemble and translate menu */
        menu = function( req, opts ) {
            opts = opts || {};

            var modules = { early: [], main: [], admin: [], late: [], final: [] };
            _.each( k.hierarchy.upParts( req.kern.website ), function( website ) {
                if( !_.has( subModules, website ) )
                    return;

                _.each( modules, function( module, key ) {
                    modules[ key ] = _.union( module, subModules[ website ][ key ].menu );
                });
            });

            /* flatten menu */
            modules = _.union( modules.early, modules.main, modules.admin, modules.late, modules.final )

            var menuItems = _.map( modules, function( module ) {
                return _.extend( module, {
                    name: module.english != "" ? req.locales.__( module.english ) : ""
                });
            });

            if( opts.showAll )
                return menuItems;

            return _.filter( menuItems, function( item ) {
                return allowed( req, item.link );
            } );
        };

        /* add site modules */
        addPermissionType = function( link, website ) {
            if( Array.isArray( link ) )
                link.forEach( (link) => subModules[website].permissionTypes.push(link) );
            else
                subModules[website].permissionTypes.push( link );
        }

        function getPermissionTypes( website ) {
            /* top of hierarchy reached */
            if( website == null )
                return [];
            /* framework in-between website */
            if( !subModules[website] )
                return getPermissionTypes( k.hierarchy.up( website ) );
            /* found, concat and move up further */
            return subModules[website].permissionTypes.concat( getPermissionTypes( k.hierarchy.up( website ) ) );
        }

        addSiteModule = function( link, website, filename, name, glyph, opts ) {
            opts = opts || {};
            if( !_.has( subModules, website ) )
                websiteSubmodules( website );

            addPermissionType( link, website );

            var subRouter = subModules[ website ][ opts.router || "main" ].router;
            var subMenu = subModules[ website ][ opts.menu || opts.router || "main" ].menu;
            var target;
            /* function passed directly */
            if( typeof filename === "function" )
                target = filename;
            else
                target = k.siteModule( website, filename, opts ).router;

            subRouter.use( "/" + link, target );
            if( link != "" && glyph != "" )
                subMenu.push( { link: link, glyph: glyph, english: name, opts: opts } );
        };

        /* main admin modules */
        /* TODO: is website really required? won't it be "default" always? */
        //addSiteModule( "navigation","default", "navigation.js",     "Navigation",   "list",     { router: "admin" } );
        addSiteModule( "media",     "default", "media.js",          "Media",        "picture",  { router: "admin" } );
        addSiteModule( "editor",    "default", "editor.js",         "Editor",       "edit",     { router: "admin" } );
        addSiteModule( "users",     "default", "users.js",          "Users",        "user",     { router: "admin", setup: {
                getPermissionTypes: getPermissionTypes
            }
        });
        addSiteModule( "locales",   "default", "missingLocales.js", "",             "comment",  { router: "admin" } );

        /* TODO: write media upload & explore-tool */
        //addSiteModule( "media", "default", "media.js", "Media", "folde-open" );

        /* logout function */
        addSiteModule( "logout", "default", function( req, res ) {
            req.sessionInterface.destroy( req, res, function() {
                k.jade.render( req, res, "admin/logout" );
            });
        }, "Logout", "log-out", { router: "late" } );

        /* manual info (first item, last match) */
        addSiteModule( "", "default", function( req, res ) {
            k.jade.render( req, res, "admin/info", viewValues( req ) );
        }, "Info", "info-sign", { router: "final", menu: "early" } );

        /* use routers by hierarchy and priority */
        k.router.use( function( req, res, next ) {
            var routers = ["early", "main", "admin", "late", "final"];
            var currentRouters;
            var website = "dummy." + req.kern.website;

            /* get next up website which is registered in subModules */
            function upSite() {
                website = k.hierarchy.up( website );

                /* end - no more websites */
                if( !website )
                    return null;

                /* found */
                if( _.has( subModules, website ) ) {
                    currentRouters = routers.slice(0);
                    return website;
                }

                /* check next upSite */
                return upSite();
            }
            upSite();

            function useNext( _req, _res, _next ) {
                var routerName = currentRouters.shift();

                /* handle errors */
                if( _req instanceof Error )
                    return next( _req );

                /* if no router is left, upSite, if all sites are done, use next router */
                if( !routerName ) {
                    if( upSite() )
                        routerName = currentRouters.shift();
                    else
                        next();
                }

                subModules[ website ][ routerName ].router.handle( req, res, useNext );
            }
            useNext( req, res, next );
        });

        k.router.use( function( req, res ) {
            console.log( "Done".green.bold );
            res.end( "DONE\n\n" );
            //console.log( util.inspect( req ) );
        });

    },
    values: viewValues,
    addValuesCallback: addValuesCallback,
    allowed: allowed,
    addPermissionType: function() {
        addPermissionType.apply( this, arguments );
    },
    addSiteModule: function() {
        addSiteModule.apply( this, arguments );
    },
    getMenu: function() {
        return menu.apply( this, arguments );
    }
};
