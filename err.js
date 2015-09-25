// error reporting
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var _ = require( "underscore" );
var httpStati = require( "./httpStati" );

module.exports = function _err( k ) {

    function renderHttpStatus( req, res, code , opts ) {
        if( !_.has( httpStati, code ) )
            code = 501;
        opts = opts || {}

        res.status( code );
        k.jade.render( req, res, "httpStatus", _.extend( { code: code }, httpStati[ code ], opts.values || {} ) );
    }

    function isDebugHost( ip ) {
        /* check all debugHost-prefixes */
        var debugHosts = k.kernOpts.debugHosts || [];
        for( var i = 0; i < debugHosts.length; i++ )
            if( ip.indexOf( debugHosts[i] ) === 0 )
                return true;

        return false;
    }

    function route() {
        k.app.use(function(err, req, res, next) {
            res.status(err.status || 500);
            /* short error message for hierarchy-404s */
            if( err.status == 404 )
                console.log( "ERROR HANDLER 404".red, err.message );
            else {
                console.log( "ERROR HANDLER!".red.bold, err.message, "\n", err.stack );
                console.trace();
            }

            /* render error, view stack if debugHost */
            k.jade.render( req, res, "error", {
                debugHost: isDebugHost( req.kern.remoteIp ),
                message: err.message,
                error: err
            });
        });

        /* catch all / show 404 */
        k.app.use(function( err, req, res, next ) {
            console.log( "ERROR HANDLER2".red.bold, err );
            if( err.status !== 404 )
                return next();
                
            if( req.config )
                k.jade.render( req, res, "websites/kern/views/layout.jade" );
            else
                k.jade.render( req, res, "no-config", {}, { website: "kern" } );
        });

        k.app.use(function( err, req, res, next ) {
            res.status("500").send("Strange ERROR:" +err.toString() );
        });

        k.app.use(function( req, res, next ) {
            res.status("404").send("Strange 404 - EOK");
        });
    }

    function routeLog( router ) {
        var args = [];
        Array.prototype.push.apply( args, arguments );
        args.shift();

        router.use( function( req, res, next ) {
            console.log.apply( console, args );
            next();
        });
    }

    return {
        renderHttpStatus: renderHttpStatus,
        routeLog: routeLog,
        route: route
    }
};
