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
var cookieParser = require( "cookie-parser" );

/* TODO: add session support for token and co */
//var session = require('express-session') , RedisStore = require('connect-redis')(session);
//app.use(session({ store: new RedisStore(options), secret: 'keyboard cat' }))

/* kern subsystems */
var hierarchy   = require("./hierarchy");
var requestData = require("./requestData");
var postman     = require("./postman");
var session     = require("./session");

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
    setupEnabled: true,
    websitesRoot: 'websites',
    viewFolder: 'views',
    rootFolder: __dirname,
    processCount: 1
    // processCount: specify the number of worker-processes to create
};

serverConfig = _.extend( defaults, serverConfig );
console.log( "CONFIG:", serverConfig );



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

        app.use(function (req, res, next) {

            /* get website from host, use kern if no config is set */
            var website = hierarchy.website( kernOpts.websitesRoot, req.host ) || "default";
            if( !( serverConfig.active || false ) )
                website = "kern";

            console.log( "AUTHTOKEN:", serverConfig.authToken );

            requestData( req );

            req.kern = {
                website: website,
                lookupFile: function( filePath ) {
                    return hierarchy.lookupFileThrow( kernOpts.websitesRoot, website, filePath );
                }
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
        app.renderJade = function( res, website, filename, locals, opts ) {
            /* cache hit, TODO: check for file-change, or just push clear cache on kern.js-aware change */
            console.log( "RENDER: ", website, filename );

            var cacheName = website + '//' + filename;
            if( cacheName in app.jadeCache ) {
                res.send( app.jadeCache[ cacheName ]( locals ) );
                return;
            }

            console.log( "CACHE: ", cacheName );

            /* compile template */
            var filepath = hierarchy.lookupFile( kernOpts.websitesRoot, website, path.join( kernOpts.viewFolder, filename + '.jade' ) );
            console.log( kernOpts.websitesRoot, website, path.join( kernOpts.viewFolder, filename + '.jade' ) );
            console.log( "FILEPATH:", filepath );

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
                // disable cache until dependencies are checked
                //app.jadeCache[ cacheName ] = compiledJade;
                var html = compiledJade( locals );

                res.send( html );
            });
        };


        /* override jade's resolvePath to use kern-hierarchy */
        jade.Parser.prototype.resolvePath = function (filename, purpose) {
            var callerFile = this.filename;
            var callerDir = path.dirname( callerFile.substring( callerFile.lastIndexOf( '/views/' ) + '/views/'.length ) );

            return hierarchy.lookupFileThrow( kernOpts.websitesRoot, this.options.kernWebsite, path.join( kernOpts.viewFolder, path.join( callerDir, filename + '.jade' ) ) );
        };

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

        callback( app );

        /* site-modules */
        function siteModule( filename ) {
            /* get site specific script and execute it */
            target = require( filename );

            var router = express.Router();
            target.setup({
                modules: {
                    postman: postman
                },
                router: router,
                serverConfig: serverConfig,
                renderJade: app.renderJade,
                rdb: rdb
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
                    
                    target = siteModule( './' + siteFilename );
                    websites[ req.kern.website ] = target;
                }
                else
                    next();
            }

            /* execute target site-script */
            if( target != null && "router" in target )
                target.router( req, res, next );
        });

        /* administration interface */
        app.use( "/admin", siteModule( "./" + hierarchy.lookupFile( kernOpts.websitesRoot, "default", "administration.js" ) ).router );

        /* catch all / show 404 */
        app.get("/", function( req, res ) {
            if( req.config )
                app.renderJade( res, "websites/kern/views/layout.jade" );
            else
                app.renderJade( res, "kern", "no-config" );
        });

	/* tail functions */
        app.use( function() {
            /* save session (so there is one ) */
            if( req.sessionInterface )
                req.sessionInterface.save() 
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

