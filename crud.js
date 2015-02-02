// CRUD Create Read Update Delete Interface
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var _       = require("underscore");
var async   = require("async");
var moment  = require("moment");
var path    = require("path");
var express = require("express");

module.exports = function( rdb ) {

    function getField( item, field ) { 
        var index = field.indexOf( "." );
        if( index > 0 ) 
            return getField( item[ field.substring( 0, index ) ], field.substring( index + 1 ) );
        else
            return item[ field ]
    };

    rdb.getField = getField;

    /* TODO: sql CRUD */
    function sqlCrud( db, opts ) {

        opts = opts || {};

        opts = _.extend( {
            key: "id",
            foreignName: "name",
            foreignNameSeparator: " ",
            orderBy: "name",
            selectFields: "",
            nestTables: false
        }, opts );

        opts = _.extend( {
            idField: opts.id,
            insertQuery: "INSERT INTO ?? SET ?",
            updateQuery: "UPDATE ?? SET ? WHERE ??=?",
            deleteQuery: "DELETE FROM ?? WHERE ??=?",
            selectAllQuery: { sql: "SELECT * " + opts.selectFields + " FROM ?? ORDER BY ??", nestTables: opts.nestTables },
            selectIdQuery: { sql: "SELECT * " + opts.selectFields + " FROM ?? WHERE ??=?", nestTables: opts.nestTables },
            selectForeignKeyQuery: "SELECT ??, ?? FROM ?? ORDER BY ??"
        }, opts );

        opts = _.extend( {
            selectListQuery: opts.selectAllQuery
        }, opts );

        function create( obj, callback ) {
            /* TODO: DEBUG */
            db.query( opts.insertQuery, [ opts.table, obj ], callback );
        }

        function createOrUpdate( obj, callback ) {
            var key = obj[ opts.key ];
            read( key, function( err, data ) {
                if( err )
                    return callback( err, [] );

                if( data.length == 0 )
                    create( obj, callback );
                else
                    update( key, obj, callback );
            });
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

        /* TODO: difference to readForeignKey? function really needed to justify enum foreignBoldName? */
        function readList( callback, listOpts ) {
            listOpts = listOpts || {};
            db.query( listOpts.query || opts.selectListQuery, [ opts.table, opts.orderBy ], callback );
        }

        function readForeignKey( callback, foreignOpts ) {

            readList( function( err, data ) {
                if( err )
                    return callback( err );

                var items = _.map( data, function( row ) {

                    var name = rdb.getField( row, opts.foreignName );
                    if( opts.foreignBoldName )
                        name = rdb.getField( row, opts.foreignBoldName ) + opts.foreignNameSeparator + name;

                    return {
                        id: rdb.getField( row, opts.key ),
                        name: name
                    }
                });

                callback( err, items );

            }, foreignOpts );
        }

        function readWhere( name, values, callback ) {
            var where = opts.wheres[ name ];
            values.unshift( opts.table ); /* make table the first item */
            values.push( opts.orderBy );  /* add order by */

            db.query( "SELECT * FROM ?? WHERE " + where.where + " ORDER BY ??", values, callback );
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
                createOrUpdate: createOrUpdate,
                read:   read,
                readAll:readAll,
                readList: readList,
                readForeignKey: readForeignKey,
                readWhere: readWhere,
                update: update,
                del:    del,
                foreignKeys: opts.foreignKeys || []
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
            idField: opts.id || "id",
            filters: {
                date:       "dateTime",
                email:      "email",
                enum:       "alnum",
                tel:        "telephone",
                text:       "address",
                foreign:    "uint",
                textarea:   "text",
                checkbox:   "exists"
            },
            elements: {
                date:       "date-field",
                email:      "email-field",
                enum:       "enum-field",
                foreign:    "foreign-field",
                tel:        "tel-field",
                text:       "text-field",
                textarea:   "textarea-field",
                checkbox:   "checkbox-field"
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
                    console.log( fieldOpts, opts.filter );

                    if( !_.has( req.filters, filterName ) && filterName != 'exists' )
                        throw new Error( "CRUD: Undefined Filter >" + filterName + "< (field:" + field + ")" );

                    values[ field ] = req[ source ][ filterName ]( fieldOpts.name || field );

                    /* local date format to iso */
                    if( fieldOpts.type == "date" )
                        values[ field ] = moment( values[ field ], req.locales.__( "date-format-moment" ) ).format("YYYY-MM-DD hh:mm:ss");
                });

                return values;
            },
            getRequestId: function( req ) {
                return req.requestData.escapedLink( opts.idField );
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
                        var id = req.postman.escapedLink( "delete" );

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
            getRequestId: opts.getRequestId,
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
            },
            crud: crud
        };
    };

    /* linker: expose for AJAX */
    function linker( k, crud, opts ) {
        opts = _.extend( {
            id: "id",
            path: "/"
        }, opts);

        opts = _.extend( {
            readPath:   path.join( opts.path, "read/:id?"   ),
            idField:    "id",
            readAllPath:path.join( opts.path, "read-all"    ),
            createPath: path.join( opts.path, "create"      ),
            updatePath: path.join( opts.path, "update/:id?" ),
            deletePath: path.join( opts.path, "delete/:id?" )
        }, opts);

        //var r = router( k, [ opts.createPath, opts.readPath, opts.updatePath, opts.deletePath ], crud, opts );
        //var r = express.Router();
        r = k.router;

        r.post( opts.createPath, function( req, res, next ) {
            crud.create( crud.readFields( req ), function( err, data ) {
                if( err ) next( err ); else res.json( data );
            });
        });
        
        r.get( opts.readPath, function( req, res, next ) {
            crud.read( req.requestData.escapedLink( opts.idField ), function( err, data ) {
                if( err ) next( err ); else res.json( data );
            });
        });

        r.get( opts.readAllPath, function( req, res, next ) {
            crud.readAll( function( err, data ) {
                if( err ) next( err ); else res.json( data );
            });
        });

        /* wheres */
        _.each( crud.wheres, function( where, name ) {

            var url = path.join( opts.path, "where", name );
            where.parameters.forEach( function( parameter ) {
                url = path.join( url, ":" + parameter.name );
            });

            r.get( url, function( req, res, next ) {

                var values = [];

                where.parameters.forEach( function( parameter ) {
                    values.push( req.requestData[ parameter.filter || "alnum" ]( parameter.name ) );
                });
                crud.readWhere( name, values, function( err, data ) {
                    if( err )
                        return next( err );

                    res.json( data );
                });
            });
        });

        r.post( opts.updatePath, function( req, res, next ) {
            var id = req.requestData.escapedLink( opts.idField );
            var data = crud.readFields( req );
            if( !id )
                id = data[ opts.id ];

            crud.update( id, data, function( err ) {
                if( err ) next( err ); else res.json( {} );
            });
        });

        r.post( opts.deletePath, function( req, res, next ) {
            var id = req.requestData.escapedLink( opts.idField );
            var data = crud.readFields( req );
            if( !id )
                id = data[ opts.id ];
            
            crud.del( id, function( err ) {
                if( err ) next( err ); else res.json( {} );
            });
        });

    };

    function presenter( k, crud, opts ) {
        opts = _.extend( {
            id: "id",
            addPath: "/",
            title: "Crud",
            path: "/admin/crud",
            idField: "id",
            editPath: "/edit/:id?",
            jadeFile: "admin/crud"
        }, opts);

        var r = router( k, [ opts.addPath, opts.editPath ], crud, opts );

        function renderAll( req, res, next, values ) {
            r.crud.readList( function( err, items ) {
                if( err ) {
                    return next( err );
                }

                var fields = r.getFields( req );

                async.map( _.keys( crud.foreignKeys ), function( fkey, done ) {

                    if( !_.has( fields, fkey ) )
                    {
                        console.log( "ForeignKey not registered: ".bold.red, fkey )
                        return done( new Error( "ForeignKey not registered: " + fkey ) );
                    }

                    crud.foreignKeys[ fkey ].crud.readForeignKey( function( err, data ) {
                        if( err )
                            return done( err );

                        fields[ fkey ].items = data;
                        done();
                    }, crud.foreignKeys[ fkey ] );

                }, function( err ) {
                    if( err )
                        return next( err );

                    var jadeCrudOpts = {
                        items: items,
                        idField: opts.id,
                        boldDisplay: opts.boldDisplay,
                        display: crud.foreignName,
                        boldDisplay: crud.foreignBoldName,
                        link: opts.path,
                        fields: fields,
                        values: r.getValues( req, fields, values )
                    };

                    k.renderJade( req, res, opts.jadeFile, k.reg("admin").values( req, { messages: req.messages, title: opts.title, opts: jadeCrudOpts } ) );
                });
            });
        }

        k.router.get(opts.editPath, function( req, res, next ) {
            crud.read( r.getRequestId( req ), function( err, data ) {
                if( err )
                    return next( err );

                /* no matching dataset, render "add" */
                if( _.isArray( data ) ) {
                    req.messages.push( { type: "danger", title: req.locales.__("Error"), text: req.locales.__( "Unknown ID" ) } );
                    renderAll( req, res, next );
                }
                /* dataset found, render "edit" */
                else
                    renderAll( req, res, next, data );
            });
        });

        k.router.get( opts.addPath, function( req, res, next ) {
            renderAll( req, res, next );
        });
    };

    rdb.crud = {
        setHash: setHash,
        setSet: setSet,
        sql: sqlCrud,
        router: router,
        linker: linker,
        presenter: presenter
    };
};
