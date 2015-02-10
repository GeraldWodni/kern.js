// Redis Cache
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var _ = require("underscore");

module.exports = function _cache( rdb ) {
    return function _createCache( cacheName, opts ) {

        opts = _.extend({
            timeout: 60
        }, opts || {} );

        /* cache disabled, return dummy functions */
        if( opts.disabled )
            return {
                get: function( prefix, name, callback ) { callback( null, null ); },
                set: function( prefix, name, value, callback ) { callback( null, null ); }
            }

        
        /* generate key */
        function key( prefix, name ) {
            return prefix + ":cache:" + cacheName + ":" + name;
        }

        /* load value */
        function get( prefix, name, callback ) {
            console.log( "Cache GET".bold.green, prefix, name );
            rdb.get( key( prefix, name ), callback );
        }

        /* store value and place TTL */
        function set( prefix, name, value, callback ) {
            var k = key( prefix, name );
            console.log( "Cache SET".bold.green, prefix, name );
            rdb.multi().set( k, value ).expire( k, opts.timeout ).exec( callback );
        }

        return {
            get: get,
            set: set
        }
    };
};
