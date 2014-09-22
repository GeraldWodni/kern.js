// Main File, setup kern and spawn workers
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var cluster = require("cluster");
var hub     = require("clusterhub");
var os      = require("os");
var path    = require("path");
var express = require("express");
var fs      = require("fs");
var jade    = require("jade");
var logger  = require("morgan");
var _       = require("underscore");
var less    = require("less");
var redis   = require("redis");
var bcrypt  = require("bcrypt-nodejs");
var colors  = require("colors");
var cookieParser = require( "cookie-parser" );
var async   = require( "async" );

/* TODO: add session support for token and co */
//var session = require('express-session') , RedisStore = require('connect-redis')(session);
//app.use(session({ store: new RedisStore(options), secret: 'keyboard cat' }))

/* kern subsystems */
var hierarchy   = require("./hierarchy");
var requestData = require("./requestData");
var postman     = require("./postman");
var session     = require("./session");
var users       = require("./users");
var locales     = require("./locales");
var navigation  = require("./navigation");
var crud        = require("./crud");

/* serverConfig, load from file if exists */
var serverConfig = {
};

try { 
    serverConfig = JSON.parse( fs.readFileSync("serverConfig.json", { encoding: "utf-8" } ) );
} catch( err ) {
}

/* default value for kern instances */
var defaults = {
    port: 3000,
    setupEnabled: false,
    websitesRoot: 'websites',
    viewFolder: 'views',
    rootFolder: __dirname,
    processCount: 1,
    cacheJade: false // disable cache until dependencies are checked
    // processCount: specify the number of worker-processes to create
};

serverConfig = _.extend( defaults, serverConfig );
console.log( "CONFIG:", serverConfig );

/* TODO: comment out following line before shipment */
serverConfig.active = true;



/* main export */
var Kern = function( callback, kernOpts ) {
    
    kernOpts = _.extend( serverConfig, kernOpts );
    var status = {
        workerId: cluster.isMaster ? 0 : cluster.worker.id
    };

    function debug() {
        console.log.apply( this, arguments );
    };

    function worker() {

        /* start express, add kern attributes */
        var app = express();
        app.disable('x-powered-by');
        
        var rdb = redis.createClient();

        rdb.on( "error", function( err ) {
            console.log( "Redis-error " + err );
        });

        /* get hash by index-hash */
        rdb.hhgetall = function( indexHash, prefix, itemname, callback ) {
            rdb.hget( indexHash, itemname, function( err, data ) {
                if( err )
                    return callback( err );

                rdb.hgetall( prefix + data, function( err, data ) {
                    if( err )
                        return callback( err );

                    return callback( null, data );
                });
            });
        };

        rdb.sall = function( setname, worker, callback ) {
            rdb.smembers( setname, function( err, data ) {
                if( err )
                    return callback( err );

                async.map( data, worker, callback );
            });
        };

        rdb.shgetall = function( setname, prefix, callback ) {
            rdb.sall( setname, function( item, next ) {
                rdb.hgetall( prefix + item, next );
            }, callback );
        }

        rdb.lall = function( listname, worker, callback ) {
            rdb.lrange( listname, 0, -1, function( err, data ) {
                if( err )
                    return callback( err );

                async.map( data, worker, callback );
            });
        };

        /* delete all keys from index-list */
        rdb.ldel = function( listname, prefix, callback ) {
            rdb.lall( listname, prefix, function( item, next ) {
                rdb.del( prefix + "item", next );
            }, callback );
        };

        /* get all hash-items by list */
        rdb.lhgetall = function( listname, prefix, callback ) {
            rdb.lrange( listname, 0, -1, function( err, data ) {
                if( err )
                    return callback( err );

                async.map( data, function( item, next ) {
                    rdb.hgetall( prefix + item, function( err, data ) {
                        if( err )
                            callback( err );
                        else
                            callback( null, _.extend( data, { hkey: item } ) );
                    });
                }, callback );
            });
        };

        /* setup crud interface */
        crud( rdb );

        app.postHooks = [];

        app.use(function (req, res, next) {

            /* get website from host, use kern if no config is set */
            var website = hierarchy.website( kernOpts.websitesRoot, req.host ) || "default";
            if( !( serverConfig.active || false ) )
                website = "kern";

            if( kernOpts.setupEnabled )
                console.log( "AUTHTOKEN:", serverConfig.authToken );

            requestData( req );

            req.kern = {
                website: website,
                lookupFile: function( filePath ) {
                    return hierarchy.lookupFileThrow( kernOpts.websitesRoot, website, filePath );
                },
                renderJade: app.renderJade
            };

            req.messages = [];

            var ended = false;
            var end = res.end;
            res.end = function( chunk, encoding ) {
                if( ended )
                    return false;
                ended = true;

                end.call( res, chunk, encoding );

                app.postHooks.forEach( function( postHook ){
                    postHook( req, res );
                });
            };

            next();
        });

        app.debug = debug;
        app.worker = worker;
        app.status = status;

        /* add kern subsystems */
        app.use( cookieParser() );
        app.use( session( rdb ) );
        app.use( logger('dev') );
        //app.use( config() );

        app.jadeCache = {};
        app.renderJade = function( req, res, filename, locals, opts ) {

            /* allow website override */
            var website = req.kern.website;
            if( opts && opts.website )
                website = opts.website;

            console.log( "RENDER: ", website );

            /* cache hit, TODO: check for file-change, or just push clear cache on kern.js-aware change */

            locals = _.extend( locals || {}, {
                __: req.locales.__
            });

            var cacheName = website + '//' + filename;
            if( cacheName in app.jadeCache ) {
                console.log( "Jade Cachehit ".grey, filename.cyan, website.grey );
                res.send( app.jadeCache[ cacheName ]( locals ) );
                return;
            }

            /* compile template */
            var filepath = hierarchy.lookupFile( kernOpts.websitesRoot, website, path.join( kernOpts.viewFolder, filename + '.jade' ) );

            opts = opts || {};
            _.extend( opts, {
                filename: filepath,
                kernWebsite: website,
            } );

            fs.readFile( filepath, 'utf8', function( err, data ) {
                if( err ) {
                    console.log( err );
                    res.send("ERROR: " + err );
                    return;
                }

                var compiledJade = jade.compile( data, opts );

                if( kernOpts.cacheJade )
                    app.jadeCache[ cacheName ] = compiledJade;

                var html = compiledJade( locals );
                console.log( "Jade Rendered ".grey, filename.green, website.grey );
                res.send( html );
            });
        };

        users( rdb );
        //rdb.users.create( "wodni.at", { name: "test", password: "1234", value: "23" }, function( err ) { console.log( "User-Create Err:", err ) } );
        //rdb.users.load( "wodni.at", "gerald", function( err, data ) {
        //    console.log( "User-Load Err:", err, "Data:", data );
        //});
        //rdb.users.create( "kern", { name: "gerald", password: "1234" }, function( err ) { console.log( "User-Create Err:", err ) } );
        rdb.users.login( "wodni.at", "test", "1234", function ( err, data ) {
            console.log( "User-Load Err:", err, "Data:", data );
        });


        /* override jade's resolvePath to use kern-hierarchy */
        jade.Parser.prototype.resolvePath = function (filename, purpose) {
            var callerFile = this.filename;
            var callerDir = path.dirname( callerFile.substring( callerFile.lastIndexOf( '/views/' ) + '/views/'.length ) );

            return hierarchy.lookupFileThrow( kernOpts.websitesRoot, this.options.kernWebsite, path.join( kernOpts.viewFolder, path.join( callerDir, filename + '.jade' ) ) );
        };

        /* serve static content like images and javascript */
        function serveStatic( directory, req, res ) {
            var filename = req.requestData.filename( 'file' );
            var filepath = hierarchy.lookupFileThrow( kernOpts.websitesRoot, req.kern.website, path.join( directory, filename ) );

            res.sendfile( filepath );
        };

        app.get("/images/:file", function( req, res, next ) {
            serveStatic( "images", req, res );
        });

        app.get("/js/:file", function( req, res, next ) {
            serveStatic( "js", req, res );
        });
        app.get("/js/:directory/:file", function( req, res, next ) {
            serveStatic( "js/" + req.requestData.filename( 'directory' ), req, res );
        });

        app.get("/fonts/:file", function( req, res, next ) {
            serveStatic( "fonts", req, res );
        });

        /* less, circumvent path-processing */
        app.get("/css/:file", function( req, res, next ) {

            var filename = req.requestData.filename( 'file' );
            var filepath = hierarchy.lookupFile( kernOpts.websitesRoot, req.kern.website, path.join( 'css', filename ) );

            if( filepath == null )
                filepath = hierarchy.lookupFileThrow( kernOpts.websitesRoot, req.kern.website, path.join( 'css', filename.replace( /\.css$/g, '.less' ) ) );

            fs.readFile( filepath, 'utf8', function( err, data ) {
                if( err ) {
                    console.log( err );
                    res.send("ERROR: " + err );
                    return;
                }

                /* parse less & convert to css */
                var parser = new less.Parser({
                    filename: filepath,
                    paths: 
                    hierarchy.paths( kernOpts.websitesRoot, req.kern.website, 'css' )
                });

                parser.parse( data, function( err, tree ) {
                    if( err ) {
                        console.log( err );
                            res.send( "ERROR" + err );
                        next();
                        return;
                    }

                    var css = tree.toCSS();
                    res.set( 'Content-Type', 'text/css' );
                    res.send( css );
                });
            });
        });

        /* enable dynamic-modules ( not needed for static files ) */
        app.use( locales( rdb ) );

        //app.use( rdb.users.loginRequired( function( req, res, next ) {
        //    app.renderJade( res, req.kern.website, "admin/login" );
        //}) );

        callback( app );

        /* site-modules */
        function siteModule( website, filename, opts ) {
            /* get site specific script and execute it */

            if( !opts || !opts.exactFilename )
                filename = "./" + hierarchy.lookupFileThrow( kernOpts.websitesRoot, website, filename );

            target = require( filename )

            var router = express.Router();
            target.setup({
                modules: {
                    hierarchy: hierarchy,
                    postman: postman
                },
                siteModule: siteModule,
                useSiteModule: function( prefix, website, filename, opts ) {
                    var subTarget = siteModule( website, filename, opts );
                    router.use( prefix, subTarget.router );
                },
                router: router,
                serverConfig: serverConfig,
                renderJade: app.renderJade,
                rdb: rdb,
                kernOpts: kernOpts
            });

            /* attach new router */
            target.router = router;
            return target;
        };

        /* site-specific route */
        var websites = {};
        app.use(function (req, res, next) {
            var target;
            if( req.kern.website in websites )
                target = websites[ req.kern.website ];
            else {

                /* get site specific script and execute it */
                var siteFilename = hierarchy.lookupFile( kernOpts.websitesRoot, req.kern.website, "site.js" );
                if( siteFilename != null ) {
                    console.log( "Using ".red.bold, siteFilename );

                    try {
                        target = siteModule( '', './' + siteFilename, { exactFilename: true } );
                        websites[ req.kern.website ] = target;
                    } catch( err ) {
                        return next( err );
                    }
                }
                else
                    next();
            }

            /* execute target site-script */
            if( target != null && "router" in target )
                target.router( req, res, next );
        });
        
        app.use( "/", navigation( rdb ) );

        /* administration interface */
        app.use( "/admin", siteModule( "default", "administration.js" ).router );

        app.use(function(err, req, res, next) {
            res.status(err.status || 500);
            console.log( "ERROR HANDLER!".red.bold, err.message, "\n", err.stack );
            app.renderJade( req, res, "error", {
                message: err.message,
                error: err
            });
        });

        /* catch all / show 404 */
        app.use(function( err, req, res, next ) {
            console.log( "ERROR HANDLER2".red.bold, err );
            if( err.status !== 404 )
                return next();
                
            if( req.config )
                app.renderJade( req, res, "websites/kern/views/layout.jade" );
            else
                app.renderJade( req, res, "no-config", {}, { website: "kern" } );
        });

        /* tail functions */
        app.postHooks.push( function( req, res ) {
            /* save session (so there is one ) */
            /* TODO: store sessionId in req.sessionId? */
            if( req.sessionInterface )
                req.sessionInterface.save( req, res, function() {} ) 
        });

        /* start listener */
        app.listen( kernOpts.port );
    }

    return {
        run: function() {

            if( cluster.isMaster ) {
                /* form workers */
                var processCount = kernOpts.processCount || os.cpus().length;
                var authToken = bcrypt.genSaltSync( 42 );

                debug( "Master, starting " + processCount + " workers" );

                for( var i = 0; i < processCount; i++ ) {
                    var child = cluster.fork();
                    child.send( { authToken: authToken } );
                }

                /* respawn dead workers */
                cluster.on( "exit", function( worker, code, signal ) {
                    debug( "Worker #" + worker.process.pid + " died, respawning" );
                    var child = cluster.fork();
                    child.send( { authToken: authToken } );
                } );

            } else {
                /* worker */
                debug( "Worker on Port " + kernOpts.port + ", id:" + status.workerId );

                process.on( "message", function( msg ) {
                    if( msg.authToken )
                        serverConfig.authToken = msg.authToken
                });

                worker();
            }
        }
    };
};

module.exports = Kern;

