// CRUD Create Read Update Delete Interface
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var _       = require("underscore");
var async   = require("async");
var moment  = require("moment");

module.exports = function( rdb ) {

    /* TODO: sql CRUD */
    function sqlCrud( db, opts ) {

        opts = opts || {};

        opts = _.extend( {
            key: "id",
            foreignName: "name",
            orderBy: "id",
            selectFields: "",
            nestTables: false
        }, opts );

        opts = _.extend( {
            insertQuery: "INSERT INTO ?? SET ?",
            updateQuery: "UPDATE ?? SET ? WHERE ??=?",
            deleteQuery: "DELETE FROM ?? WHERE ??=?",
            selectAllQuery: { sql: "SELECT * " + opts.selectFields + " FROM ?? ORDER BY ??", nestTables: opts.nestTables },
            selectIdQuery: { sql: "SELECT * " + opts.selectFields + " FROM ?? WHERE ??=?", nestTables: opts.nestTables },
            selectForeignKeyQuery: "SELECT ??, ?? FROM ?? ORDER BY ??"
        }, opts );


        function create( obj, callback ) {
            /* TODO: DEBUG */
            db.query( opts.insertQuery, [ opts.table, obj ], callback );
        }

        function read( key, callback ) {
            db.query( opts.selectIdQuery, [ opts.table, opts.key, key ], function( err, data ) {
                if( err )
                    callback( err );
                else if( data.length == 0 )
                    callback( null, [] );
                else
                    callback( null, data[0] );
            });
        }

        function readAll( callback ) {
            db.query( opts.selectAllQuery, [ opts.table, opts.orderBy ], callback );
        }

        function readForeignKey( callback ) {
            db.query( opts.selectForeignKeyQuery, [ opts.key, opts.foreignName, opts.table, opts.orderBy ], function( err, data ) {
                if( err )
                    callback( err );
                else {
                    var keyValues = _.reduce( data, function( obj, row ) {
                        obj[ row[ opts.key ] ] = row[ opts.foreignName ];
                        return obj;
                    }, {} );

                    callback( err, keyValues );
                }
            });
        }

        function update( key, obj, callback ) {
            db.query( opts.updateQuery, [ opts.table, obj, opts.key, key ], callback );
        }

        function del( key, callback ) {
            db.query( opts.deleteQuery, [ opts.table, opts.key, key ], callback );
        }

        return _.extend(
            {
                create: create,
                read:   read,
                readAll:readAll,
                readForeignKey: readForeignKey,
                update: update,
                del:    del
            }, opts );
    }

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
            filters: {
                date:       "dateTime",
                email:      "email",
                enum:       "alnum",
                tel:        "telephone",
                text:       "alnum",
                textarea:   "text"
            },
            elements: {
                date:       "date-field",
                email:      "email-field",
                enum:       "enum-field",
                tel:        "tel-field",
                text:       "text-field",
                textarea:   "textarea-field"
            },
            fields: {
                id:     { type: "id" },
                name:   { type: "alnum" },
                value:  { type: "allocnum" }
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
            readFields: function( req ) {
                var values = {};
                _.each( opts.fields, function( fieldOpts, field ) {
                    var source = fieldOpts.source || "postman";
                    var filterName = fieldOpts.filter || opts.filters[ fieldOpts.type ];

                    if( !_.has( req.filters, filterName ) )
                        throw new Error( "CRUD: Undefined Filter >" + filterName + "< (field:" + field + ")" );

                    values[ field ] = req[ source ][ filterName ]( fieldOpts.name || field );

                    /* local date format to iso */
                    if( fieldOpts.type == "date" )
                        values[ field ] = moment( values[ field ], req.locales.__( "date-format-moment" ) ).format("YYYY-MM-DD hh:mm:ss");
                });

                return values;
            },
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

                        if( crud.create.length == 2 )
                            crud.create( obj, handleCreate );
                        /* predetermined id */
                        else if( crud.create.length == 3 )
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

                        /* sql */
                        if( crud.update.length == 3 )
                            crud.update( id, obj, handleUpdate );
                        /* fixed id */
                        else if( crud.update.length == 4 )
                            crud.update( req.kern.website, id, obj, handleUpdate );
                        /* id change permitted */
                        else
                            crud.update( req.kern.website, id, obj[ opts.id ], obj, handleUpdate );
                    }
                    else if( req.postman.exists( "delete" ) ) {
                        var id = opts.getRequestId( req );

                        function handleDelete( err ) {
                            if( err )
                                return opts.__error( err, req, res, next );

                            req.messages.push( { type: "success", title: req.locales.__("Success"), text: req.locales.__("Item deleted") } );
                            opts.success( req, res, next );
                        };

                        if( crud.del.length == 2 )
                            crud.del( id, handleDelete );
                        else
                            crud.del( req.kern.website, id, handleDelete );
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
            handlePost: handlePost,
            getFields: function( req ) {
                var jadeFields =  {}
                _.each( opts.fields, function( fieldOpts, field ) {
                    /* ignore fields with no type (idsignore fields with no type (ids)) */
                    if( fieldOpts.type ) {
                        var element = "text-field"
                        if( _.has( opts.elements, fieldOpts.type ) )
                            element = opts.elements[ fieldOpts.type];
                        else
                            throw new Error( "CRUD Unknown Element " + fieldOpts.type );
                        //console.error( "CRUD Element ".magenta.bold, element, "(" + field + ": " + fieldOpts.type + ")" );

                        /** some fields require special  **/
                        /* translate values */
                        if( _.has( fieldOpts, "keys" ) && !_.has( fieldOpts, "keyValues" ) ) {
                            fieldOpts.keyValues = {}
                            _.each( fieldOpts.keys, function( key ) {
                                fieldOpts.keyValues[ key ] = req.locales.__( key );
                            });
                        }

                        jadeFields[ field ] = _.extend( fieldOpts, {
                            mixinType: element
                        });
                    }
                } );

                return jadeFields;
            },
            getValues: function( req, fields, values ) {
                _.each( values, function( value, key ) {
                    if( !_.has( fields, key ) )
                        return;

                    if( fields[ key ].mixinType == "date-field" ) {
                        var t = moment( values[ key ] );
                        if( t.isValid() )
                            values[ key ] = t.format( req.locales.__( "date-format-moment" ) );
                        else
                            values[ key ] = "";
                    }
                });

                return values;
            }
        };
    }

    rdb.crud = {
        setHash: setHash,
        setSet: setSet,
        sql: sqlCrud,
        router: router
    };
};
