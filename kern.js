// Main File, setup kern and spawn workers
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var cluster = require("cluster");
var os      = require("os");
var path    = require("path");
var url     = require("url");
var express = require("express");
var fs      = require("fs");
var logger  = require("morgan");
var _       = require("underscore");
var bcrypt  = require("bcrypt-nodejs");
var colors  = require("colors");
var cookieParser = require( "cookie-parser" );
var http    = require("http");

/* TODO: add session support for token and co */
//var session = require('express-session') , RedisStore = require('connect-redis')(session);
//app.use(session({ store: new RedisStore(options), secret: 'keyboard cat' }))

/* kern subsystems */
require("./strings");

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
    processCount: 1, // TODO: change this to CPU count or # of websites, allow multiple processes per website
    debugHosts: [ '127.', '10.', '192.168.' ],  // LAN-Clients are debug-hosts ( advanced debugging like stack traces etc. is displayed )
    cacheJade: true // disable cache until dependencies are checked
    // processCount: specify the number of worker-processes to create
};

serverConfig = _.extend( defaults, serverConfig );
console.log( "Starting kern.js".yellow.bold );

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

    function loadModule( k, name, opts ) {
        module = require( "./" + name );
        k[ name ] = module( k, opts );
    }

    function worker() {

        /* start express, add kern attributes */
        var app = express();
        app.disable( 'x-powered-by' );
        app.debug = debug;
        app.worker = worker;
        app.status = status;

        /* websocket support */
        require( "express-ws" )( app );

        /* load modules */
        var k = {
            app: app,
            kernOpts: kernOpts
        };
        loadModule( k, "err"        );
        loadModule( k, "hooks"      );
        loadModule( k, "hierarchy"  );
        loadModule( k, "rdb"        );
        loadModule( k, "db"         );
        loadModule( k, "users"      );
        loadModule( k, "crud"       );
        loadModule( k, "filters"    );
        loadModule( k, "session"    );
        loadModule( k, "locales"    );
        loadModule( k, "requestman" );
        loadModule( k, "getman"     );
        loadModule( k, "postman"    );
        loadModule( k, "cache"      );
        loadModule( k, "site"       );
        loadModule( k, "proxyCache" );
        loadModule( k, "siteConfig" );
        loadModule( k, "static"     );
        loadModule( k, "jade"       );
        loadModule( k, "data"       );

        k.site.routeRequestStart();

        /* add kern subsystems */
        app.use( cookieParser() );
        k.session.route();
        app.use( logger('dev') );
        //app.use( config() );

        /* load locales now to support locale error messages (also required for static-404s) */
        k.locales.route();

        /* serve static files */
        k.static.route();

        /* enable dynamic-modules */
        if( typeof callback === 'function' )
            callback( app );

        /* site-modules */

        /** site-specific route **/

        /* look for site-specific route */
        app.use( k.site.getOrLoad );

        //app.use( "/", navigation( rdb ) );

        /* administration interface */
        app.use( "/admin", k.site.module( "default", "administration.js", { register: "admin" } ).router );



        /* configure websites (async) */
        var serverInstance = null;
        k.siteConfig.loadAll(function() {

            /** handle errors **/
            k.err.route();

            /* tail functions */
            k.session.pushPostHook();
            k.hooks.routePostHooks();

            /* start listener */
            console.log("All Sites loaded".bold.magenta);
            serverInstance = app.listen( kernOpts.port );
        });

        /* process hooks */
        return {
            exit: function _onExit(){
                k.hooks.execute( "exit" );
                if( serverInstance ) {
                    console.log( "Stop listening".bold.red );
                    serverInstance.close();
                }
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

                /* TODO: each website shall spawn at least one new process, and reverse-authenticate here */
                /* TODO: overwrite require prototype and add file-watchers to all included files for each website */
                /* TODO: only restart affected websites */
                /* TODO: fix cache to contain website */
                /* opaque: does not transmit headers correctly */
                /* http://stackoverflow.com/questions/20351637/how-to-create-a-simple-http-proxy-in-node-js */
                http.createServer(
                function onRequest(req, res) {
                    var targetUrl = req.headers.host;
                    var colonPos = targetUrl.indexOf( ":" );
                    if( colonPos > 0 )
                        targetUrl = targetUrl.substring( 0, colonPos );

                    console.log( "MasterProxy".bold.magenta, targetUrl, req.method );
                    var options = {
                        hostname: targetUrl,
                        port: kernOpts.port,
                        path: req.url,
                        method: req.method
                    };

                    var proxy = http.request(options, function (proxyRes) {
                        proxyRes.pipe(res, { end: true });
                    });
                    req.pipe(proxy, { end: true });

                }).listen(9000);

                /* works transparent http://www.catonmat.net/http-proxy-in-nodejs/ */
                http.createServer(function(request, response) {
                    var targetHostName = request.headers.host;
                    var colonPos = targetHostName.indexOf( ":" );
                    if( colonPos > 0 )
                        targetHostName = targetHostName.substring( 0, colonPos );

                  var proxy = http.createClient(kernOpts.port, targetHostName);
                  var proxy_request = proxy.request(request.method, request.url, request.headers);
                  proxy_request.addListener('response', function (proxy_response) {
                    proxy_response.addListener('data', function(chunk) {
                      response.write(chunk, 'binary');
                    });
                    proxy_response.addListener('end', function() {
                      response.end();
                    });
                    response.writeHead(proxy_response.statusCode, proxy_response.headers);
                  });
                  request.addListener('data', function(chunk) {
                    proxy_request.write(chunk, 'binary');
                  });
                  request.addListener('end', function() {
                    proxy_request.end();
                  });
                }).listen(7000);


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

