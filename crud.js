// CRUD Create Read Update Delete Interface
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var _       = require("underscore");
var async   = require("async");

module.exports = function( rdb ) {

    /* TODO: sql CRUD */
    function sqlCrud( sql, opts ) {
        function create( obj ) {
        }

        return _.extend(
            {
                create: create
            }, opts );
    }

    function post( router, module, id, fields, crud, opts ) {

        opts = _.extend( {
            getId: function( req ) {
                return req.postman.number( id );
            },
            getPrefix: function( req ) {
                return req.kern.website;
            }
        }, opts );

        function response( err, res ) {
            if( !err )
                res.send( "okay" );
            else
                res.sendError( 404, err );
        };

        return function( req, res, next ) {
            console.log( "CRUD POST".red.bold ); 
            k.modules.postman( req, res, function() {

                function readFields() {
                    /* TODO: correctly parse all fields */

                    next( "Not enough fields" );
                };

                if( req.postman.exists( "create" ) ) {
                    crud.create( opts.getPrefix( req ), getId( req ), readFields(), response );
                }
                else if( req.postman.exists( "update"  ) ) {

                }
                else if( req.postman.exists( "delete" ) ) {
                    
                }
                else
                    next();
            });
        }



        /* TODO: which one is better?
        router.post();...

        return function( req, res, next )...
        */
    };

    function setHash( module, opts ) {

        opts = opts || {};
        
        /* default key construction */
        var separator = opts.separator || ":";
        function getIndexKey( prefix ) {
            return prefix + separator + module;
        };
        function getKeyBase( prefix ) {
            return prefix + separator + module + separator;
        };
        function getKey( prefix, id ) {
            return getKeyBase( prefix ) + id;
        };

        opts = _.extend( {
            getIndexKey: getIndexKey,
            getKeyBase: getKeyBase,
            getKey: getKey
        }, opts);

        /* crud */
        function create( prefix, id, obj, callback ) {
            if( typeof callback != "function" )
                throw new Error( "crud.create: invalid callback provided" );

            async.series( [
                function( done ) { rdb.sadd( opts.getIndexKey( prefix ), id,  done ); },
                function( done ) { rdb.hmset( opts.getKey( prefix, id ), obj, done ); }
            ], callback );
        };
        function readAll( prefix, callback) {
            rdb.shgetall( opts.getIndexKey( prefix ), opts.getKeyBase( prefix ), callback );
        };
        function read( prefix, id, callback ){
            rdb.hgetall( opts.getKey( prefix, id ), callback );
        };
        function del( prefix, id, callback ) {
            async.parallel( [
                function( done ) { rdb.srem( getIndexKey( prefix ), id, done ); },
                function( done ) { rdb.del( getKey( prefix, id ), done ); },
            ], callback );
        };
        function update( prefix, oldId, newId, obj, callback ) {
            async.series( [
                function( d ) { del( prefix, oldId, d ); },
                function( d ) { create( prefix, newId, obj, d ); }
            ], callback );
        }

        return {
            create: create,
            read:   read,
            readAll:readAll,
            update: update,
            del:    del
        }
    }

    rdb.crud = {
        setHash: setHash
    };
};
