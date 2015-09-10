// Redis Cache
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var fs  = require("fs");
var _   = require("underscore");

module.exports = function _cache( k ) {
    return function _createCache( opts ) {

        opts = _.extend({
            timeout: 6 * 60 * 60,
            prefix: "cache:"
        }, opts || {} );

        /* cache disabled, return dummy functions */
        if( opts.disabled )
            return {
                get: function( filename, callback ) { callback( null, null ); },
                set: function( filename, content, callback ) { callback( null, null ); }
            }

        /* start watches for keys currently in cache */
        k.rdb.keys( opts.prefix + "*", function( err, keys ) {
            keys.forEach( function( key ) {
                k.rdb.ttl( key, function( err, ttl ) {
                    var filename = key.substring( opts.prefix.length );
                    /* create watch for file */
                    try {
                        watchFile( filename, ttl );

                    } catch( e ) {
                        /* check why watch has failed */
                        if( e.code != "ENOENT" )
                            throw e;

                        /* file has been deleted, delete cache as well */
                        k.rdb.del( key );
                    }
                });
            });
        });

        /* generate key */
        function key( filename ) {
            return opts.prefix + filename;
        }

        /* watch for changes to file */
        function watchFile( filename, timeout ) {
            /* start filewatch */
            var watcher = fs.watch( filename, function( event, fname ) {
                console.log( "Cache Changed".grey, filename.yellow );
                /* if a change occured, clear cache */
                k.rdb.del( key( filename ), function() {
                    watcher.close();
                });
            });

            /* stop watcher when cache hits TTL */
            setTimeout( function() {
                if( watcher && watcher.close() )
                    watcher.close()
            }, ( timeout || opts.timeout ) * 1000 );
        }

        /* load value */
        function get( filename, callback ) {
            k.rdb.get( key( filename ), callback );
        }

        /* store value and place TTL */
        function set( filename, content, callback ) {
            var fileKey = key( filename );
            k.rdb.multi().set( fileKey, content ).expire( fileKey, opts.timeout ).exec( callback );
            watchFile( filename );
        }

        return {
            get: get,
            set: set
        }
    };
};
