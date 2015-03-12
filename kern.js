// Main File, setup kern and spawn workers
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var cluster = require("cluster");
var os      = require("os");
var path    = require("path");
var url     = require("url");
var express = require("express");
var fs      = require("fs");
var jade    = require("jade");
var logger  = require("morgan");
var _       = require("underscore");
var less    = require("less");
var bcrypt  = require("bcrypt-nodejs");
var colors  = require("colors");
var cookieParser = require( "cookie-parser" );
var async   = require( "async" );

/* TODO: add session support for token and co */
//var session = require('express-session') , RedisStore = require('connect-redis')(session);
//app.use(session({ store: new RedisStore(options), secret: 'keyboard cat' }))

/* kern subsystems */
require("./strings");
var hierarchy   = require("./hierarchy");
var httpStati   = require("./httpStati");
var filters     = require("./filters");
var requestData = require("./requestData");
var postman     = require("./postman");
var session     = require("./session");
var users       = require("./users");
var locales     = require("./locales");
var navigation  = require("./navigation");
var Rdb         = require("./rdb");
var Cache       = require("./cache");
var crud        = require("./crud");

/* serverConfig, load from file if exists */
var serverConfig = {
};

try { 
    /* TODO: use os.hostname, rename serverConfig? */
    os.hostname();
    serverConfig = JSON.parse( fs.readFileSync("serverConfig.json", { encoding: "utf-8" } ) );
} catch( err ) {
}

/* default value for kern instances */
var defaults = {
    port: 8000,
    setupEnabled: false,
    websitesRoot: 'websites',
    viewFolder: 'views',
    rootFolder: __dirname,
    processCount: 1,
    cacheJade: true // disable cache until dependencies are checked
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
        app.disable( 'x-powered-by' );

        /* websocket support */
        require( "express-ws" )( app );

        /* connect to redis */
        var rdb = Rdb();
        var cache = Cache( rdb );

        /* setup crud interface */
        crud( rdb );

        app.postHooks = [];
        app.exitHooks = [];

        app.use(function (req, res, next) {

            /* get website from host, use kern if no config is set */
            var website = hierarchy.website( kernOpts.websitesRoot, req.host ) || "default";
            if( !( serverConfig.active || false ) )
                website = "kern";

            if( kernOpts.setupEnabled )
                console.log( "AUTHTOKEN:", serverConfig.authToken );

            filters( req );
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

        /* set jade pretty-print */
        app.jadeCache = {};
        app.renderJade = function( req, res, filename, locals, opts ) {

            app.set('view options', { pretty: true });

            /* allow website override */
            var website = req.kern.website;
            if( opts && opts.website )
                website = opts.website;

            console.log( "Render: ".grey, website.green, filename.cyan );

            /* compile template */
            var filepath = hierarchy.lookupFile( kernOpts.websitesRoot, website, path.join( kernOpts.viewFolder, filename + '.jade' ) );
            if( !filepath ) {
                var message = "Unable to locate view " + filename + " in " + website;
                res.status(500).end( message );
                throw new Error( message.bold.red );
            }

            locals = _.extend( locals || {}, {
                __: req.locales.__,
                _: _,
                os: os
            });

            if( filepath in app.jadeCache ) {
                console.log( "Jade Cachehit ".grey, filename.cyan, website.grey );
                return res.send( app.jadeCache[ filepath ]( locals ) );
            }


            opts = opts || {};
            _.extend( opts, {
                filename: filepath,
                kernWebsite: website,
                pretty: true
            } );

            fs.readFile( filepath, 'utf8', function( err, data ) {
                if( err ) {
                    console.log( err );
                    res.send("ERROR: " + err );
                    return;
                }

                /* store dependencies */
                var dependencies = [ filepath ];
                /* override jade's resolvePath to use kern-hierarchy */
                jade.Parser.prototype.resolvePath = function (filename, purpose) {
                    var callerFile = this.filename;
                    var callerDir = path.dirname( callerFile.substring( callerFile.lastIndexOf( '/views/' ) + '/views/'.length ) );

                    var file = hierarchy.lookupFileThrow( kernOpts.websitesRoot, this.options.kernWebsite, path.join( kernOpts.viewFolder, path.join( callerDir, filename + '.jade' ) ) );
                    dependencies.push( file );
                    return file;
                };

                /* compile (synced) */
                var compiledJade = jade.compile( data, opts );

                /* store in cache */
                if( kernOpts.cacheJade ) {
                    app.jadeCache[ filepath ] = compiledJade;

                    dependencies = _.uniq( dependencies );

                    /* remove from cache on dependency change */
                    var watchers = [];
                    dependencies.forEach( function( filename ) {
                        var watcher = fs.watch( filename, function() {
                            console.log( "Jade Changed".grey, filepath.yellow, website.grey );
                            delete app.jadeCache[ filepath ];

                            /* close all watchers for root file */
                            watchers.forEach( function( watcher ) { watcher.close() } );
                        });
                        watchers.push( watcher );
                    });
                }

                var html = compiledJade( locals );
                console.log( "Jade Rendered ".grey, filename.green, website.grey );
                res.send( html );
            });
        };

        app.renderHttpStatus = function( req, res, code , opts ) {
            if( !_.has( httpStati, code ) )
                code = 501;

            res.status( code );
            app.renderJade( req, res, "httpStatus", _.extend( { code: code }, httpStati[ code ] ) );
        };

        users( rdb );
        //rdb.users.create( "wodni.at", { name: "test", password: "1234", value: "23" }, function( err ) { console.log( "User-Create Err:", err ) } );
        //rdb.users.load( "wodni.at", "gerald", function( err, data ) {
        //    console.log( "User-Load Err:", err, "Data:", data );
        //});
        //rdb.users.create( "default", { name: "gerald", password: "1234" }, function( err ) { console.log( "User-Create Err:", err ) } );


        /* serve static content like images and javascript */
        function serveStatic( directory, req, res ) {
            var filename = req.requestData.filename( 'file' );
            var filepath = hierarchy.lookupFileThrow( kernOpts.websitesRoot, req.kern.website, path.join( directory, filename ) );

            res.sendfile( filepath );
        };

        function prefixServeStatic( prefix ) {

            app.use( function( req, res, next ) {
                var pathname = url.parse( req.url ).pathname;
                pathname = path.normalize( pathname );
                //console.log( pathname );

                /* contain in directory */
                if( pathname.indexOf( ".." ) >= 0 )
                    return app.renderHttpStatus( req, res, 403 );

                if( pathname.indexOf( prefix ) == 0 ) {
                    var filepath = hierarchy.lookupFileThrow( kernOpts.websitesRoot, req.kern.website, pathname );
                    return res.sendfile( filepath );
                }

                next();
            });
        };

        /* load locales now to support locale error messages */
        app.use( locales( rdb ) );

        prefixServeStatic( "/images/" );

        //app.get("/images/:file", function( req, res, next ) {
        //    serveStatic( "images", req, res );
        //});

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
        var lessCache = cache( "less" );
        app.get("/css/*", function( req, res, next ) {

            var filename = req.path.substring( 5 );
            var filepath = hierarchy.lookupFile( kernOpts.websitesRoot, req.kern.website, path.join( 'css', filename ) );

            /* static css found, serve it */
            if( filepath != null )
                return res.sendfile( filepath );

            /* dynamic less */
            filepath = hierarchy.lookupFile( kernOpts.websitesRoot, req.kern.website, path.join( 'css', filename.replace( /\.css$/g, '.less' ) ) );
            if( filepath == null )
                return next();

            lessCache.get( filepath, function( err, data ) {

                if( err )
                    return next( err );

                if( data ) {
                    res.set( 'Content-Type', 'text/css' );
                    res.send( data );
                    return;
                }

                fs.readFile( filepath, 'utf8', function( err, data ) {
                    if( err ) 
                        return next( err );

                    /* parse less & convert to css */
                    var parser = new less.Parser({
                        filename: filepath,
                        paths: hierarchy.paths( kernOpts.websitesRoot, req.kern.website, 'css' )
                    });

                    console.log( filepath );

                    parser.parse( data, function( err, tree ) {
                        if( err )
                            return next( err );

                        var css = tree.toCSS();
                        res.set( 'Content-Type', 'text/css' );
                        res.send( css );
                        lessCache.set( filepath, css );
                    });
                });

            });
        });
        app.get("/css/:directory/:file", function( req, res, next ) {
            serveStatic( "css/" + req.requestData.filename( 'directory' ), req, res );
        });

        /* enable dynamic-modules ( not needed for static files ) */

        //app.use( rdb.users.loginRequired( function( req, res, next ) {
        //    app.renderJade( res, req.kern.website, "admin/login" );
        //}) );

        if( typeof callback === 'function' )
            callback( app );

        /* site-modules */
        var registeredSiteModules = {};
        function siteModule( website, filename, opts ) {
            /* get site specific script and execute it */
            opts = opts || {};

            if( !opts.exactFilename )
                filename = "./" + hierarchy.lookupFileThrow( kernOpts.websitesRoot, website, filename );

            target = require( filename )

            /* register module */
            if( opts.register ) {
                console.log( "Register SiteModule".magenta.bold, opts.register );
                registeredSiteModules[ opts.register ] = target;
            }

            var router = express.Router();
            target.setup({
                modules: {
                    hierarchy: hierarchy,
                    postman: postman
                },
                ws: function() {
                    app.ws.apply( this, arguments );
                },
                siteModule: siteModule,
                useSiteModule: function( prefix, website, filename, opts ) {
                    var subTarget = siteModule( website, filename, opts );
                    router.use( prefix, subTarget.router );
                },
                exitHook: function _exitHook( callback ) {
                    app.exitHooks.push( callback );
                },
                router: router,
                httpStatus: app.renderHttpStatus,
                serverConfig: serverConfig,
                prefixServeStatic: prefixServeStatic,
                serverStaticFile: function serveStatic( filename ) {
                    return function( req, res ) {
                        var filepath = hierarchy.lookupFileThrow( kernOpts.websitesRoot, req.kern.website, filename );
                        res.sendfile( filepath );
                    }
                },
                readHierarchyDir: function( website, dirname, callback ) {
                    var dirpath = hierarchy.lookupFile( kernOpts.websitesRoot, website, dirname );
                    if( dirpath == null )
                        return callback( new Error( "Dir not found" ) );
                    fs.readdir( dirpath, callback );
                },
                readHierarchyFile: function( website, filenames, callback ) {
                    if( !_.isArray( filenames ) )
                        filenames = [ filenames ];
                    
                    async.mapSeries( filenames, function( filename, d ) {
                        var filepath = hierarchy.lookupFile( kernOpts.websitesRoot, website, filename );
                        if( filepath == null )
                            return d( new Error( filename + " not found" ) );
                        fs.readFile( filepath, 'utf8', d );

                    }, callback );
                },
                createHierarchyReadStream: function( website, filename ) {
                    var filepath = hierarchy.lookupFile( kernOpts.websitesRoot, website, filename );
                    if( filepath == null )
                        return null;
                    return fs.createReadStream( filepath );
                },
                renderJade: app.renderJade,
                rdb: rdb,
                kernOpts: kernOpts,
                hostname: os.hostname(),
                reg: function( name ) {
                    return registeredSiteModules[ name ];
                }
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
        app.use( "/admin", siteModule( "default", "administration.js", { register: "admin" } ).router );

        app.use(function(err, req, res, next) {
            res.status(err.status || 500);
            console.log( "ERROR HANDLER!".red.bold, err.message, "\n", err.stack );
            console.trace();
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

        /* process hooks */
        return {
            exit: function _onExit(){
                app.exitHooks.forEach( function( hook ) {
                    hook();
                });
            }
        }
    }

    return {
        run: function() {

            if( cluster.isMaster ) {
                /* form workers */
                var processCount = kernOpts.processCount || os.cpus().length;
                var authToken = bcrypt.genSaltSync( 42 );

                debug( "Master, starting " + processCount + " workers" );

                cluster.on('fork', function(worker) {
                    console.log('worker ' + worker.process.pid + ' fork');
                });
                cluster.on('online', function(worker) {
                    console.log('worker ' + worker.process.pid + ' online');
                });
                cluster.on('listening', function(worker) {
                    console.log('worker ' + worker.process.pid + ' listening');
                });
                cluster.on('disconnect', function(worker) {
                    console.log('worker ' + worker.process.pid + ' disconnect');
                });
                  /* respawn dead workers */
                cluster.on('exit', function(worker) {
                    debug( "Worker #" + worker.process.pid + " died, respawning" );
                    var child = cluster.fork();
                    child.send( { authToken: authToken } );
                });

                for( var i = 0; i < processCount; i++ ) {
                    var child = cluster.fork();
                    child.send( { authToken: authToken } );
                }

            } else {
                /* worker */
                debug( "Worker on Port " + kernOpts.port + ", id:" + status.workerId );

                var w = null;

                process.on( "message", function( msg ) {
                    if( msg.authToken )
                        serverConfig.authToken = msg.authToken
                });

                process.on("exit", function() {
                    console.log( ( "Exit Start " + status.workerId ).red.bold );
                    w.exit();
                    console.log( ( "Exit Done " + status.workerId ).red.bold );
                });

                w = worker();
            }
        }
    };
};

var main = function() {
    Kern().run();
}

if( require.main === module )
    main();
else
    module.exports = Kern;

