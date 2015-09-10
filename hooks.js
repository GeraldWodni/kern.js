// Hooks
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var _ = require( "underscore" );

module.exports = function( k ) {
    var postHooks = [];
    var exitHooks = [];

    var hooks = {};

    function addHook( hook, callback ) {
        if( !_.has( hooks, hook ) )
            hooks[ hook ] = []

        hooks[ hook ].push( callback );
    }

    function executeHooks( hook ) {
        if( !_.has( hooks, hook ) )
            return;

        var args = [];
        Array.prototype.push.apply( args, arguments );
        args.shift(); // remove hook argument

        hooks[ hook ].forEach( function( callback ) {
            callback.apply( this, args );
        });
    }

    function routePostHooks() {
        k.app.use( function( req, res ) {
            executeHooks( "post", req, res );
        });
    }

    return {
        add: addHook,
        execute: executeHooks,
        routePostHooks: routePostHooks
    }
};
