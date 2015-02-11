// Redis Cache
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var fs  = require("fs");
var _   = require("underscore");

module.exports = function _cache( rdb ) {
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
        rdb.keys( opts.prefix + "*", function( err, keys ) {
            keys.forEach( function( key ) {
                rdb.ttl( key, function( err, ttl ) {
                    var filename = key.substring( opts.prefix.length );
                    watchFile( filename, ttl );
                });
            });
        });

        /* generate key */
        function key( filename ) {
            return opts.prefix + filename;
        }

        /* watch for changes to file */
        function watchFile( filename, timeout ) {
            console.log( "Start Watch".bold.green, filename );

            /* start filewatch */
            var watcher = fs.watch( filename, function( event, fname ) {
                console.log( "Cache CHANGE".yellow.green, filename );
                /* if a change occured, clear cache */
                rdb.del( key( filename ), function() {
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
            console.log( "Cache GET".bold.green, filename );
            rdb.get( key( filename ), callback );
        }

        /* store value and place TTL */
        function set( filename, content, callback ) {
            var k = key( filename );
            console.log( "Cache SET".bold.yellow, filename );
            rdb.multi().set( k, content ).expire( k, opts.timeout ).exec( callback );
            watchFile( filename );
        }

        return {
            get: get,
            set: set
        }
    };
};
