// Redis Cache
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var fs  = require("fs");
var _   = require("underscore");

module.exports = function _cache( k ) {
    return function _createCache( opts ) {

        opts = _.extend({
            timeout: 6 * 60 * 60,
            prefix: "cache:",
            prefixDependencies: "cache-dependencies:"
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
                    /* watch dependencies */
                    var dKey = dependenciesKey( filename );
                    k.rdb.smembers( dKey, function( err, dependencies ) {
                        /* create watch for file */
                        try {
                            watchFile( filename, dependencies, ttl );
                        } catch( e ) {
                            /* check why watch has failed */
                            if( e.code != "ENOENT" )
                                throw e;

                            /* file has been deleted, delete cache as well */
                            k.rdb.del( [key, dKey] );
                        }
                    });
                });
            });
        });

        /* generate key */
        function key( filename ) {
            return opts.prefix + filename;
        }
        function dependenciesKey( filename ) {
            return opts.prefixDependencies + filename;
        }

        /* watch for changes to file */
        function watchFile( filename, dependencies, timeout ) {

            /* start filewatch */
            console.log( "Cache-Watch:", filename, dependencies )
            var watcher = fs.watch( filename, fileChanged );
            var dependencyWatchers = [];

            function stopWatchers() {
                if( watcher && watcher.close )
                    watcher.close()

                dependencyWatchers.forEach( dependencyWatcher => {
                    if( dependencyWatcher && dependencyWatcher.close )
                        dependencyWatcher.close();
                });
            }

            function fileChanged( event, fname ) {
                console.log( "Cache Changed".grey, filename.yellow, "origin:".grey, fname.yellow );
                /* if a change occured, clear cache */
                k.rdb.del( [key( filename ), dependenciesKey( filename )], stopWatchers );
            }

            dependencies.forEach( dependency => {
                dependencyWatchers.push( fs.watch( dependency, fileChanged ) );
            });

            /* stop watcher when cache hits TTL */
            setTimeout( stopWatchers, ( timeout || opts.timeout ) * 1000 );
        }

        /* load value */
        function get( filename, callback ) {
            k.rdb.get( key( filename ), callback );
        }

        /* store value and place TTL */
        function set( filenameObj, content, callback ) {
            var filename = filenameObj;
            var dependencies = []
            if( _.isObject( filenameObj ) ) {
                filename = filenameObj.filename;
                dependencies = filenameObj.dependencies || [];
            }

            var fileKey = key( filename );
            var fileDependenciesKey = dependenciesKey( filename );
            if( dependencies.length )
                k.rdb.multi()
                    .set( fileKey, content )
                    .expire( fileKey, opts.timeout )
                    .sadd( fileDependenciesKey, dependencies )
                    .expire( fileDependenciesKey, opts.timeout )
                    .exec( callback );
            else
                k.rdb.multi()
                    .set( fileKey, content )
                    .expire( fileKey, opts.timeout )
                    .exec( callback );
            watchFile( filename, dependencies );
        }

        return {
            get: get,
            set: set
        }
    };
};
