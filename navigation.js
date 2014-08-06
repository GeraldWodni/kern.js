// Navigation
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var fs      = require("fs");
var path    = require("path");
var _       = require("underscore");
var async   = require("async");
var express = require("express");

module.exports = function( rdb ) {

    var websites = {};

    function getIndexKey( prefix ) {
        return prefix + ":navigation";
    }

    function getKey( prefix, link ) {
        return prefix + ":navigation:" + ( link || "" );
    }

    function updateLink( website, oldLink, newLink, callback ) {
        async.series( [
            function( d ) { deleteLink( website, oldLink, d ); },
            function( d ) { saveLink( website, newLink, d ); }
        ], callback );
    }

    function saveLink( website, link, callback ) {
        async.series( [
            function( done ) { rdb.sadd( getIndexKey( website ), link.link, done ); },
            function( done ) { rdb.hmset( getKey( website, link.link ), link, done ); }
        ], callback );
    }

    function deleteLink( website, link, callback ) {
        async.parallel( [
            function( done ) { rdb.del( getKey( website, link ), done ); },
            function( done ) { rdb.srem( getIndexKey( website ), link, done ); },
        ], callback );
    }

    function getLinks( website, callback ) {
        rdb.shgetall( getIndexKey( website ), getKey( website ), function( err, data ) {
            callback( err, data );
        });
    };

    function loadWebsite( website, callback ) {
        getLinks( website, function( err, data ) {
            if( err )
                return callback( err );

            var router = express.Router();
            router.get( "/navs", function( req, res ) { res.send( "NAVS!" ); } );
            
            var i = 0;

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
    }

    rdb.navigation = {
        getLinks:   getLinks,
        saveLink:   saveLink,
        updateLink: updateLink,
        deleteLink: deleteLink
    };

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
