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
                function( done ) { rdb.srem( opts.getIndexKey( prefix ), id, done ); },
                function( done ) { rdb.del( opts.getKey( prefix, id ), done ); },
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

    function setSet( module, opts ) {

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
                function( done ) { rdb.sadd( opts.getKey( prefix, id ), obj, done ); }
            ], callback );
        };
        function readAll( prefix, callback) {
            rdb.ssgetall( opts.getIndexKey( prefix ), opts.getKeyBase( prefix ), callback );
        };
        function read( prefix, id, callback ){
            rdb.smembers( opts.getKey( prefix, id ), callback );
        };
        function del( prefix, id, callback ) {
            async.parallel( [
                function( done ) { rdb.srem( getIndexKey( prefix ), id, done ); },
                function( done ) { rdb.srem( getKey( prefix, id ), done ); },
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

    function router( k, path, crud, opts ) {
        opts = _.extend( {
            id: "id",
            readFields: function( req ) {
                return {
                    id: req.postman.id(),
                    name: req.postman.alnum["name"],
                    value: req.postman.alnum["value"]
                };
            },
            success: function( req, res, next ) {
                req.method = "GET";
                next();
            },
            __error: function( err, req, res, next ) {
                req.method = "GET";
                req.messages.push( { type: "danger", title: req.locales.__("Error"), text: req.locales.__( err ) } );
                next();
            },
            error: function( err, req, res, next ) {
                req.method = "GET";
                req.messages.push( { type: "danger", title: req.locales.__("Error"), text: err } );
                next();
            }
        }, opts );

        opts = _.extend( {
            getRequestId: function( req ) {
                return req.requestData.escapedLink( opts.id );
            }
        }, opts );

        function handlePost( req, res, next )  {

            k.modules.postman( req, res, function() {

                try {
                    if( req.postman.exists( "add" ) ) {
                        var obj = opts.readFields( req );

                        function handleCreate( err ) {
                            if( err )
                                return opts.__error( err, req, res, next );

                            req.messages.push( { type: "success", title: req.locales.__("Success"), text: req.locales.__("Item added") } );
                            opts.success( req, res, next );
                        };

                        /* predetermined id */
                        if( crud.create.length == 3 )
                            crud.create( req.kern.website, obj, handleCreate);
                        /* dynamic id */
                        else
                            crud.create( req.kern.website, obj[ opts.id ], obj, handleCreate);
                    }
                    else if( req.postman.exists( "update" ) ) {
                        var id = opts.getRequestId( req );
                        var obj = opts.readFields( req );

                        function handleUpdate( err ) {
                            if( err )
                                return opts.__error( err, req, res, next );

                            req.messages.push( { type: "success", title: req.locales.__("Success"), text: req.locales.__("Item updated") } );
                            opts.success( req, res, next );
                        };

                        /* fixed id */
                        if( crud.update.length == 4 )
                            crud.update( req.kern.website, id, obj, handleUpdate );
                        /* id change permitted */
                        else
                            crud.update( req.kern.website, id, obj[ opts.id ], obj, handleUpdate );
                    }
                    else if( req.postman.exists( "delete" ) ) {
                        var id = opts.getRequestId( req );

                        crud.del( req.kern.website, id, function( err ) {
                            if( err )
                                return opts.__error( err, req, res, next );

                            req.messages.push( { type: "success", title: req.locales.__("Success"), text: req.locales.__("Item deleted") } );
                            opts.success( req, res, next );
                        });
                    }
                    else {
                        next();
                    }
                }
                catch(e) {
                    if( e.toString().indexOf( "Error:" ) == -1 )
                        opts.error( e, req, res, next );
                    else
                        throw e;
                }
            });
        };

        /* set post routes */
        if( path instanceof Array )
            path.forEach( function( p ) {
                k.router.post( p, handlePost );
            });
        else
            k.router.post( path, handlePost );

        return  {
            handlePost: handlePost
        };

    }

    rdb.crud = {
        setHash: setHash,
        setSet: setSet,
        router: router
    };
};
