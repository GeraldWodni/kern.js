// website loading (site.js)
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var express = require("express");
var fs      = require("fs");
var path    = require("path");
var os      = require("os");
var _       = require("underscore");
var async   = require( "async" );

/* generic promisify */
function p() {
    const args = [... arguments];
    const target = args.shift();
    return new Promise( (fulfill, reject) => {
        const callback = ( err, data ) => {
            if( err )
                reject(err);
            else
                fulfill( data );
        };
        args.push( callback );
        target.apply( null, args );
    });
}

module.exports = function _site( k, opts ) {

    var websites = {};
    async function load( website, next ) {
        console.log("LoadWebsite".bold.magenta, website );

        /* load website-data */
        k.data.load( website );
        let siteModuleOpts = {
            exactFilename: true,
        };
        var siteFilename = k.hierarchy.lookupFile( website, "site.mjs" );
        if( siteFilename != null )
            siteModuleOpts.esm = await import( "./" + siteFilename );
        else
            siteFilename = k.hierarchy.lookupFile( website, "site.js" );

        if( siteFilename != null  ) {
            console.log( "Using ".magenta.bold, siteFilename );
            try {
                var target = siteModule( website, './' + siteFilename, siteModuleOpts );
                websites[ website ] = target;
                console.log("LoadWebsite".bold.green, website );
                next( null, target );
            } catch( err ) {
                console.log("LoadWebsite-Error:".bold.red, err );
                next( err );
            }
        }
        else
            next();
    }

    function getTarget(req, callback) {
        function gotTarget( err, website ) {
            if( err ) return callback( err );
            req.kern.site = {
                registeredSiteModules:  website.registeredSiteModules
            };
            callback( null, website );
        }

        /* website already loaded, return it */
        if( req.kern.website in websites )
            gotTarget( null, websites[ req.kern.website ] );
        /* get site specific script and execute it */
        else
            load( req.kern.website, gotTarget );
    }

    function getOrLoad(req, res, next) {
        /* get site */
        var url = req.url;
        getTarget( req, function( err, target ){
            if( err ) return next( err );

            /* router? */
            if( target != null && "router" in target ) {
                console.log( "Routing!");
                target.router( req, res, function( err ) { console.log( "Routed" );
                    if( err ) return next( err );
                    /* repair req.url after routing websockets */
                    if( url.indexOf( ".websocket" ) >= 0 )
                        req.url = url;
                    next();
                } );
            }
            /* no router */
            else
                next();
        });
    }

    function routeRequestStart() {
        k.app.use(function (req, res, next) {

            var hostname = req.hostname;
            if( process.env.KERN_STATIC_HOST )
                hostname = process.env.KERN_STATIC_HOST;

            if( process.env.KERN_ADDITIONAL_HOSTS ) {
                const allowedHosts = process.env.KERN_ADDITIONAL_HOSTS.split( "," );
                if( allowedHosts.indexOf( req.hostname ) >= 0 )
                    hostname = req.hostname;
            }

            /* get website from host, use kern if no config is set */
            var website = k.hierarchy.website( hostname ) || "default";
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
                },
                db: k.db.get( website, true )
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

        /* esm modules come pre-loaded */
        var target;
        if( opts.esm )
            target = opts.esm.default;
        else
            target = require( filename );

        /* register module */
        if( opts.register ) {
            console.log( "Register SiteModule".magenta.bold, opts.register );
            registeredSiteModules[ opts.register ] = target;
        }

        var router = newRouter();
        target.setup({
            p,
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
            session: k.session,
            static: k.static,
            proxyCache: k.proxyCache,
            website: website,
            newRouter: newRouter,
            locales: k.locales,
            ws: function() {
                console.log( "Websocket-Server".yellow.bold, arguments );
                k.ws.apply( this, arguments );
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
                if( prefix != null )
                    router.use( prefix, subTarget.router );
            },
            exitHook: function _exitHook( callback ) {
                app.exitHooks.push( callback );
            },
            router: router,
            httpStatus: k.err.renderHttpStatus,
            serverConfig: k.kernOpts,
            prefixServeStatic: function( prefix, opts = {} ) {
                k.static.prefixServeStatic( router, prefix, opts );
            },
            singleStatic: function( path, filename, mimeType ) {
                router.get( path, k.static.single( filename, mimeType ) );
            },
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
            createHierarchyReadStream: k.hierarchy.createReadStream,
            createHierarchyWriteStream: k.hierarchy.createWriteStream,
            hostname: os.hostname(),
            getWebsiteConfig: function( key, defaultValue ) {
                var value = k.siteConfig.get( website, key, defaultValue );
                //console.log( "getWebsiteConfig", website, key, value, defaultValue )
                //console.log( websiteConfigs[ website ] ); 
                //console.log( websiteConfigs );
                return value;
            },
            reg: function( name ) {
                return registeredSiteModules[ name ];
            },
            setupOpts: opts.setup
        });

        target.registeredSiteModules = registeredSiteModules;

        /* app requires cleanup */
        if( target.exit )
            k.hooks.add( "exit", target.exit );

        /* attach new router */
        target.router = router;
        return target;
    };

    /* create customized express router */
    function newRouter() {
        var router = express.Router();

        /* overwrite postman */
        router.postman = function() {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.splice( -1, 1 )[0];     /* remove original callback */
            if( callback.length == 3 )                  /* insert wrapper instead ( arity 3 ) */
                args.push(function( req, res, next ) {
                    k.postman( req, res, function(){
                        callback( req, res, next );
                    });
                });
            else                                        /* otherwise assume function of arity 2 */
                args.push(function( req, res ) {
                    k.postman( req, res, callback );
                });
            router.post.apply( router, args );     /* route post */
        };
        return router;
    };

    return {
        load: load,
        getTarget: getTarget,
        getOrLoad: getOrLoad,
        routeRequestStart: routeRequestStart,
        module: siteModule
    }
}
