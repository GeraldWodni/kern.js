// Redis Database Interface
// (c)copyright 2014-2015 by Gerald Wodni <gerald.wodni@gmail.com>
var redis   = require("redis");
var async   = require( "async" );

module.exports = function _rdb( k, opts )  {

    var rdb = redis.createClient( opts );

    rdb.getField = function _rdb_getField( item, field ) { 
        var index = field.indexOf( "." );
        if( index > 0 ) 
            return getField( item[ field.substring( 0, index ) ], field.substring( index + 1 ) );
        else
            return item[ field ]
    };

    rdb.cloneClient = function _rdb_cloneClient() {
        return redis.createClient( opts );
    };

    rdb.on( "error", function( err ) {
        console.log( "Redis-error ".red.bold, err.stack.yellow );
        //console.trace();
    });

    /* get hash by index-hash */
    rdb.hhgetall = function( indexHash, prefix, itemname, callback ) {
        rdb.hget( indexHash, itemname, function( err, data ) {
            if( err )
                return callback( err );

            rdb.hgetall( prefix + data, function( err, data ) {
                if( err )
                    return callback( err );

                return callback( null, data );
            });
        });
    };

    rdb.sall = function( setname, worker, callback ) {
        rdb.smembers( setname, function( err, data ) {
            if( err )
                return callback( err );

            async.map( data, worker, callback );
        });
    };

    rdb.shgetall = function( setname, prefix, callback ) {
        rdb.sall( setname, function( item, next ) {
            rdb.hgetall( prefix + item, next );
        }, callback );
    }

    rdb.ssgetall = function( setname, prefix, callback ) {
        rdb.sall( setname, function( item, next ) {
            rdb.smembers( prefix + item, function( err, data ) {
                if( err )
                    return next( err );

                return next( null, data );
            });
        }, callback );
    }

    rdb.lall = function( listname, worker, callback ) {
        rdb.lrange( listname, 0, -1, function( err, data ) {
            if( err )
                return callback( err );

            async.map( data, worker, callback );
        });
    };

    /* delete all keys from index-list */
    rdb.ldel = function( listname, prefix, callback ) {
        rdb.lall( listname, prefix, function( item, next ) {
            rdb.del( prefix + "item", next );
        }, callback );
    };

    /* get all hash-items by list */
    rdb.lhgetall = function( listname, prefix, callback ) {
        rdb.lrange( listname, 0, -1, function( err, data ) {
            if( err )
                return callback( err );

            async.map( data, function( item, next ) {
                rdb.hgetall( prefix + item, function( err, data ) {
                    if( err )
                        callback( err );
                    else
                        callback( null, _.extend( data, { hkey: item } ) );
                });
            }, callback );
        });
    };

    return rdb;
};
