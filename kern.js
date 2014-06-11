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

/* kern subsystems */
var config  = require("./config");

/* default value for kern instances */
var defaults = {
    port: 3000,
    setupEnabled: true,
    websitesRoot: 'websites',
    viewFolder: 'views'
    // processCount: specify the number of worker-processes to create
};

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
            next();
        });

        app.debug = debug;
        app.worker = worker;
        app.status = status;

        /* add kern subsystems */
        app.use( logger('dev') );
	app.use( config() );

        /* locate by hierarchy: cut subdomains, then check 'default' folder  */
        function lookupFile( website, filename ) {

            /* file found */
            var filePath = path.join( kernOpts.websitesRoot, website, filename ) 
            console.log( filePath );
            if( fs.existsSync( filePath ) )
                return filePath;

            /* cut next subdomain */
            var firstDot = website.indexOf(".");
            if( firstDot >= 0 )
                return lookupFile( website.substring( firstDot + 1 ), filename );

            /* if we are at TLD, check default */
            if( website !== "default" )
                return lookupFile( "default", filename );

            /* nothing in default, just fail */
            throw new Error( "kern-lookupFile: '" + filename + "' not found!" ); 
            return null;
        }

        app.lookupFile = lookupFile;

        app.jadeCache = {};
        app.renderJade = function( res, website, filename, locals, opts ) {
            /* cache hit, TODO: check for file-change, or just push clear cache on kern.js-aware change */
            var cacheName = website + '//' + filename;
            if( cacheName in app.jadeCache ) {
                res.send( app.jadeCache[ cacheName ]( locals ) );
                return;
            }

            /* compile template */
            var filepath = lookupFile( website, path.join( kernOpts.viewFolder, filename + '.jade' ) );

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
            console.log( this.options );
            return lookupFile( this.options.kernWebsite, path.join( kernOpts.viewFolder, filename + '.jade' ) );
        };

        callback( app );

        /* show basic hello if nothing else catched up until here */
        app.get("/", function( req, res ) {
            if( req.config )
                app.renderJade( res, "websites/kern/views/layout.jade" );
            else
                app.renderJade( res, "kern", "no-config" );
        });
    
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

