// Kern base file
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var cluster = require("cluster");
//var hub = require("clusterhub");
var os      = require("os");
var path    = require("path");
var express = require("express");
var fs      = require("fs");
var jade    = require("jade");
var logger  = require("morgan");
var _       = require("underscore");
var less    = require("less");

/* kern subsystems */
var hierarchy   = require("./hierarchy");
var config      = require("./config");

/* default value for kern instances */
var defaults = {
    port: 3000,
    setupEnabled: true,
    websitesRoot: 'websites',
    viewFolder: 'views',
    rootFolder: __dirname
    // processCount: specify the number of worker-processes to create
};


/* TODO: capsule in RequestData or alike file */
var ReqData = function( req ) {
    this.req = req;
};

ReqData.prototype.raw = function( name ) {
    return this.req.params[name];
}

ReqData.prototype.filter = function( name, filter ) {
    var value = this.raw( name );

    if( value == null )
        return null;
        
    return value.replace( filter, '' );
}

ReqData.prototype.filename = function( name ) {
    return this.filter( name, /[^-_.0-9a-zA-Z]/g );
}

/* main export */
var Kern = function( callback, kernOpts ) {
    
    kernOpts = _.extend( defaults, kernOpts );
    var status = {
        workerId: cluster.isMaster ? 0 : cluster.worker.id
    };

    function debug() {
        console.log.apply( this, arguments );
    };

    function worker() {

        /* start express, add kern attributes */
        var app = express();

        /* hide identifiaction */
        app.use(function (req, res, next) {
            res.removeHeader("x-powered-by");

            var website = 'kern';

            req.kern = {
                website: website,
                data: new ReqData( req ),
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
        app.use( logger('dev') );
	app.use( config() );

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
                app.jadeCache[ cacheName ] = compiledJade;
                var html = compiledJade( locals );

                res.send( html );
            });
        };


        /* override jade's resolvePath to use kern-hierarchy */
        jade.Parser.prototype.resolvePath = function (filename, purpose) {
            return hierarchy.lookupFileThrow( kernOpts.websitesRoot, this.options.kernWebsite, path.join( kernOpts.viewFolder, filename + '.jade' ) );
        };

        /* less, circumvent path-processing */
        app.get("/css/:file", function( req, res, next ) {

            var filename = req.kern.data.filename( 'file' );
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

        /* show basic hello if nothing else catched up until here */
        app.get("/", function( req, res ) {
            if( req.config )
                app.renderJade( res, "websites/kern/views/layout.jade" );
            else
                app.renderJade( res, "kern", "no-config" );
        });

        //app.use( app.router );
    
        /* start listener */
        app.listen( kernOpts.port );
    }

    return {
        run: function() {

            if( cluster.isMaster ) {
                /* form workers */
                var processCount = kernOpts.processCount || os.cpus().length;
                debug( "Master, starting " + processCount + " workers" );
                for( var i = 0; i < processCount; i++ )
                    cluster.fork();

                /* respawn dead workers */
                cluster.on( "exit", function( worker, code, signal ) {
                    debug( "Worker #" + worker.process.pid + " died, respawning" );
                    cluster.fork();
                } );

            } else {
                /* worker */
                debug( "Worker on Port " + kernOpts.port + ", id:" + status.workerId );
                worker();
            }
        }
    };
};

module.exports = Kern;

