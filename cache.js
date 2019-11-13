// Redis Cache
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var fs  = require("fs");
var _   = require("underscore");

module.exports = function _cache( k ) {
    return function _createCache( opts ) {

        opts = _.extend({
            timeout: 6 * 60 * 60,
            /* TODO: rename to cache: after migration period */
            prefix: "cache2:",
            prefixDependencies: "cache2-dependencies:"
        }, opts || {} );

        /* cache disabled, return dummy functions */
        if( opts.disabled )
            return {
                get: function( filename, callback ) { callback( null, null ); },
                set: function( filename, content, callback ) { callback( null, null ); }
            }

        /* start watches for keys currently in cache */
        k.rdb.keys( opts.prefix + "*", function( err, keys ) {
            if( err )
                return console.log( "Cache-Error:".bold.red, err );
            keys.forEach( function( key ) {
                k.rdb.ttl( key, function( err, ttl ) {
                    var filename = key.substring( opts.prefix.length );
                    var website = filename.split(":")[1];
                    filename = website.substring( 0, filename.length - website.length - 1 );
                    /* watch dependencies */
                    var dKey = dependenciesKey( filename );
                    k.rdb.smembers( dKey, function( err, dependencies ) {
                        /* create watch for file */
                        try {
                            watchFile( { filename: filename, website: website }, dependencies, ttl );
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
        function key( obj ) {
            return opts.prefix + obj.filename + ":" + obj.website;
        }
        function dependenciesKey( obj ) {
            return opts.prefixDependencies + obj.filename  + ":" + obj.website;
        }

        /* watch for changes to file */
        function watchFile( filenameObj, dependencies, timeout ) {

            /* start filewatch */
            console.log( "Cache-Watch:", filenameObj.filename + " : " + filenameObj.website, dependencies )
            var watcher = fs.watch( filenameObj.filename, fileChanged );
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
                console.log( "Cache Changed".grey, (filenameObj.filename + " : " + filenameObj.website).yellow, "origin:".grey, fname.yellow );
                /* if a change occured, clear cache */
                k.rdb.del( [key( filenameObj ), dependenciesKey( filenameObj )], stopWatchers );
            }

            dependencies.forEach( dependency => {
                dependencyWatchers.push( fs.watch( dependency, fileChanged ) );
            });

            /* stop watcher when cache hits TTL */
            setTimeout( stopWatchers, ( timeout || opts.timeout ) * 1000 );
        }

        /* load value */
        function get( filenameObj, callback ) {
            k.rdb.get( key( filenameObj ), callback );
        }

        /* store value and place TTL */
        function set( filenameObj, content, callback ) {
            var dependencies = filenameObj.dependencies || [];

            var fileKey = key( filenameObj );
            var fileDependenciesKey = dependenciesKey( filenameObj );
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
            watchFile( filenameObj, dependencies );
        }

        return {
            get: get,
            set: set
        }
    };
};
