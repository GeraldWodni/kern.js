// caching proxy
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var fs   = require("fs");
var http = require("http");
var path = require("path");
var _    = require("underscore");

module.exports = function _proxyCache( k ) {
    /* generic hit or load */
    function serve( website, filename, res, loader ) {
        
        var cacheStream = k.hierarchy.createReadStream( website, filename );
        /* local copy exists, pipe it */
        cacheStream.on( "open", function() {
            cacheStream.pipe( res );
        });

        /* no local copy, load then save & pipe */
        cacheStream.on( "error", function() {
            loader( function( getRes ) {
                var writeStream = k.hierarchy.createWriteStream( website, filename );
                writeStream.on( "error", function( err ) {
                    console.log( "proxyCache Error".bold.red, err );
                });

                getRes.pipe( writeStream );
                getRes.pipe( res );
            });
        });
    }

    /* gravatar proxy */
    function gravatar( website, router, opts ) {
        opts = _.defaults( opts || {}, {
            url: "/proxy/gravatar/:email/:size/:default",
            prefix: "/proxy/gravatar",
        });

        /* parse url */
        router.get( opts.url, function( req, res ) {
            k.requestman( req );
            var email   = req.requestman.hex("email");
            var size    = req.requestman.uint("size");
            var def     = req.requestman.id("default");
            var cacheFilename = path.join( opts.prefix, email + "-" + size + "-" + def );

            /* provide loader on cache miss */
            serve( website, cacheFilename, res, function( callback ) {
                http.get( "http://www.gravatar.com/avatar/" + email + "?s=" + size + "&d=" + def, callback);
            });
        });

    }

    return {
        gravatar: gravatar
    }
};

