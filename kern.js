// Kern base file
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var cluster = require("cluster");
//var hub = require("clusterhub");
var os      = require("os");
var express = require("express");
var fs      = require("fs");
var jade    = require("jade");
var _       = require("underscore");

/* default value for kern instances */
var defaults = {
    port: 3000,
    setupEnabled: true
    // processCount: specify the number of worker-processes to create
};

/* main export */
var Kern = function( callback, opts ) {
    
    opts = _.extend( defaults, opts );
    var status = {
        workerId: cluster.isMaster ? 0 : cluster.worker.id
    };

    function debug() {
        console.log.apply( this, arguments );
    };

    function worker() {

        /* start express, add kern attributes */
        var app = express();
        app.debug = debug;
        app.worker = worker;
        app.status = status;

        app.jadeCache = {};
        app.renderJade = function( res, filename, locals, opts ) {
            /* TODO: add cache */
            //if( filename in app.jadeCache )
            //    app.jadeCache[ filename ]( locals );

            fs.readFile( filename, 'utf8', function( err, data ) {
                if( err ) {
                    console.log( err );
                    res.send("ERROR: " + err );
                    return;
                }

                var compiledJade = jade.compile( data, opts );
                var html = compiledJade( locals );

                res.send( html );
            });
        };



        /* register the app's functions */
        callback( app );

        /* run setup if nothing else catched the request */
        app.get("/", function( req, res ) {
            app.renderJade( res, "websites/kern/views/layout.jade" );
            app.debug( "DONE!" );
        });

    
        /* start listener */
        app.listen( opts.port );
    }

    return {
        run: function() {

            if( cluster.isMaster ) {
                /* form workers */
                var processCount = opts.processCount || os.cpus().length;
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
                debug( "Worker on Port " + opts.port + ", id:" + status.workerId );
                worker();
            }
        }
    };
};

module.exports = Kern;

