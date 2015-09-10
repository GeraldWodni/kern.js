// website loading (site.js)
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var express = require("express");
var fs      = require("fs");
var path    = require("path");
var os      = require("os");
var _       = require("underscore");
var async   = require( "async" );

module.exports = function _site( k, opts ) {

    var websites = {};
    function load( website, next ) {
        console.log("LoadWebsite".bold.magenta, website, websites );

        /* load website-data */
        k.data.load( website );
        var siteFilename = k.hierarchy.lookupFile( website, "site.js" );
        if( siteFilename != null ) {
            console.log( "Using ".magenta.bold, siteFilename );
            try {
                var target = siteModule( website, './' + siteFilename, { exactFilename: true } );
                websites[ website ] = target;
                console.log("LoadWebsite".bold.green, website, websites );
                return target;
            } catch( err ) {
                console.log("LoadWebsite-Error:".bold.red, err );
                next( err );
            }
        }
        else
            next();

        return null;
    }

    function getOrLoad(req, res, next) {
        var target;
        if( req.kern.website in websites )
            target = websites[ req.kern.website ];
        else
            /* get site specific script and execute it */
            target = load( req.kern.website, next );

        /* execute target site-script */
        if( target != null && "router" in target )
            target.router( req, res, next );
    }

    function routeRequestStart() {
        k.app.use(function (req, res, next) {

            /* get website from host, use kern if no config is set */
            var website = k.hierarchy.website( req.host ) || "default";
            if( !( k.kernOpts.active || false ) )
                website = "kern";

            if( k.kernOpts.setupEnabled )
                console.log( "AUTHTOKEN:", k.kernOpts.authToken );

            k.requestman( req );
            k.getman( req );

            req.kern = {
                website: website,
                remoteIp: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                lookupFile: function( filePath ) {
                    return k.hierarchy.lookupFileThrow( website, filePath );
                },
                getWebsiteConfig: function( key, defaultValue ) {
                    return k.siteConfig.get( website, key, defaultValue );
                }
            };

            req.messages = [];

            var ended = false;
            var end = res.end;
            res.end = function( chunk, encoding ) {
                if( ended )
                    return false;
                ended = true;

                end.call( res, chunk, encoding );

                k.hooks.execute("post", req, res);
            };

            next();
        });
    }

    var registeredSiteModules = {};
    function siteModule( website, filename, opts ) {
        /* get site specific script and execute it */
        opts = opts || {};

        if( !opts.exactFilename )
            filename = "./" + k.hierarchy.lookupFileThrow( website, filename );

        var target = require( filename )

        /* register module */
        if( opts.register ) {
            console.log( "Register SiteModule".magenta.bold, opts.register );
            registeredSiteModules[ opts.register ] = target;
        }

        var router = express.Router();
        target.setup({
            db: k.db,
            getDb: function() {
                return k.db.get( website );
            },
            rdb: k.rdb,
            data: k.data,
            getData: function() {
                return k.data.get( website );
            },
            users: k.users,
            err: k.err,
            jade: k.jade,
            crud: k.crud,
            hierarchy: k.hierarchy,
            hooks: k.hooks,
            filters: k.filters,
            getman:  k.getman,
            postman: k.postman,
            requestman: k.requestman,
            website: website,
            ws: function() {
                console.log( "Websocket-Server".yellow.bold, arguments );
                k.app.ws.apply( this, arguments );
            },
            siteRequire: function _siteRequire( website, filename ) {

                var filepath = k.hierarchy.lookupFile( website, filename );
                if( filepath != null ) {
                    return require( "./" + filepath )
                }
                else
                    throw new Error( "siteRequire failed, '" + website + "' '" + filename + "' not found" );
            },
            siteModule: siteModule,
            useSiteModule: function( prefix, website, filename, opts ) {
                //console.log( "USE".magenta.bold, website, filename );
                var subTarget = siteModule( website, filename, opts );
                router.use( prefix, subTarget.router );
            },
            exitHook: function _exitHook( callback ) {
                app.exitHooks.push( callback );
            },
            router: router,
            httpStatus: k.err.renderHttpStatus,
            serverConfig: k.kernOpts,
            prefixServeStatic: k.static.prefixServeStatic,
            serveStaticFile: function _serveStatic( filename ) {
                return function( req, res ) {
                    var filepath = k.hierarchy.lookupFileThrow( req.kern.website, filename );
                    res.sendfile( filepath );
                }
            },
            hierarchyRoot: function( website ) {
                var root = k.hierarchy.website( website );
                if( root )
                    return path.join( k.kernOpts.websitesRoot, root );
                else
                    return null;
            },
            readHierarchyDir: function( website, dirname, callback ) {
                var dirpath = k.hierarchy.lookupFile( website, dirname );
                if( dirpath == null )
                    return callback( new Error( "Dir not found" ) );
                fs.readdir( dirpath, callback );
            },
            readHierarchyFile: function( website, filenames, callback ) {
                if( !_.isArray( filenames ) )
                    filenames = [ filenames ];
                
                async.mapSeries( filenames, function( filename, d ) {
                    var filepath = k.hierarchy.lookupFile( website, filename );
                    if( filepath == null )
                        return d( new Error( filename + " not found" ) );
                    fs.readFile( filepath, 'utf8', d );

                }, callback );
            },
            createHierarchyReadStream: function( website, filename ) {
                var filepath = k.hierarchy.lookupFile( website, filename );
                if( filepath == null )
                    return null;
                return fs.createReadStream( filepath );
            },
            hostname: os.hostname(),
            getWebsiteConfig: function( key, defaultValue ) {
                var value = k.siteConfig.get( website, key, defaultValue );
                console.log( "getWebsiteConfig", website, key, value, defaultValue )
                console.log( websiteConfigs[ website ] ); 
                console.log( websiteConfigs );
                return value;
            },
            reg: function( name ) {
                return registeredSiteModules[ name ];
            }
        });

        /* app requires cleanup */
        if( target.exit )
            k.hooks.add( "exit", target.exit );

        /* attach new router */
        target.router = router;
        return target;
    };

    return {
        load: load,
        getOrLoad: getOrLoad,
        routeRequestStart: routeRequestStart,
        module: siteModule
    }
}
