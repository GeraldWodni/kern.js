// Navigation
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var fs      = require("fs");
var path    = require("path");
var _       = require("underscore");
var async   = require("async");
var express = require("express");

module.exports = function( rdb ) {

    var websites = {};

    function getIndexKey( prefix ) {
        return prefix + ":navigation";
    };

    function getKey( prefix, link ) {
        return prefix + ":navigation:" + ( link || "" );
    };

    function loadWebsite( website, callback ) {
        rdb.navigation.readAll( website, function( err, data ) {
            if( err )
                return callback( err );

            var router = express.Router();
            router.get( "/navs", function( req, res ) { res.send( "NAVS!" ); } );
            
            var i = 0;

            console.log( "DATA:", data );

            data.sort( function( a, b ) {
                return b.link.length - a.link.length;
            });

            data.forEach(function( item ) {
                console.log( "Route ->", item );

                //router.get( "/nav/" + (i++), 
            });

            websites[ website ] = router;
            callback( null, router );
        });
    };

    rdb.navigation = k.crud.setHash( "navigation" );

    return function( req, res, next ) {
        if( req.website in websites )
            websites[req.website].handle( req, res, next );
        else
            loadWebsite( req.website, function( err, router ) {
                if( err )
                    return next( err );

                router.handle( req, res, next );
            });
    };
};
