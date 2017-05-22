// CRUD Create Read Update Delete Interface
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var _       = require("underscore");
var async   = require("async");
var moment  = require("moment");
var path    = require("path");
var express = require("express");

module.exports = function _crud( k ) {

    /* TODO: sql CRUD */
    function sqlCrud( db, opts ) {

        opts = opts || {};

        opts = _.extend( {
            key: "id",
            foreignName: "name",
            foreignNameSeparator: " ",
            orderBy: opts.foreignName || "name",
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
            /* remove primary key if transmitted */
            if( opts.autoKey && _.has( obj, opts.key ) )
                delete obj[ opts.key ];

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
            var values = [ opts.table, opts.key, key ];
            if( _.has( key, "key" ) ) {
                values = key;
                values.values = [ opts.table, opts.key, key.key ];
            }

            db.query( opts.selectIdQuery, values, function( err, data ) {
                if( err )
                    callback( err );
                else if( data.length == 0 )
                    callback( null, [] );
                else
                    callback( null, data[0], data );
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

                    var name = k.rdb.getField( row, opts.foreignName );
                    if( opts.foreignBoldName )
                        name = k.rdb.getField( row, opts.foreignBoldName ) + opts.foreignNameSeparator + name;

                    return {
                        id: k.rdb.getField( row, opts.key ),
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
            if( opts.disallowKeyUpdate )
                delete obj[opts.key];
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
                foreignKeys: opts.foreignKeys || [],
                type: "sql"
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
                function( done ) { k.rdb.sadd( opts.getIndexKey( prefix ), id,  done ); },
                function( done ) { k.rdb.hmset( opts.getKey( prefix, id ), obj, done ); }
            ], callback );
        };
        function readAll( prefix, callback) {
            k.rdb.shgetall( opts.getIndexKey( prefix ), opts.getKeyBase( prefix ), callback );
        };
        function read( prefix, id, callback ){
            k.rdb.hgetall( opts.getKey( prefix, id ), callback );
        };
        function del( prefix, id, callback ) {
            async.parallel( [
                function( done ) { k.rdb.srem( opts.getIndexKey( prefix ), id, done ); },
                function( done ) { k.rdb.del( opts.getKey( prefix, id ), done ); },
            ], callback );
        };
        function update( prefix, id, obj, callback ) {
            updateId( prefix, id, id, obj, callback );
        }
        function updateId( prefix, oldId, newId, obj, callback ) {
            async.series( [
                function( d ) { del( prefix, oldId, d ); },
                function( d ) { create( prefix, newId, obj, d ); }
            ], callback );
        }

        return {
            create:     create,
            read:       read,
            readAll:    readAll,
            update:     update,
            updateId:   updateId,
            del:        del
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
                function( done ) { k.rdb.sadd( opts.getIndexKey( prefix ), id,  done ); },
                function( done ) { k.rdb.sadd( opts.getKey( prefix, id ), obj, done ); }
            ], callback );
        };
        function readAll( prefix, callback) {
            k.rdb.ssgetall( opts.getIndexKey( prefix ), opts.getKeyBase( prefix ), callback );
        };
        function read( prefix, id, callback ){
            k.rdb.smembers( opts.getKey( prefix, id ), callback );
        };
        function del( prefix, id, callback ) {
            async.parallel( [
                function( done ) { k.rdb.srem( getIndexKey( prefix ), id, done ); },
                function( done ) { k.rdb.srem( getKey( prefix, id ), done ); },
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

    /* extends base crud (create, read, readAll, update, del) to full crud */
    function base( crud ) {

        if( !_.has( crud, "readList" ) )
            crud.readList = function _baseCrud_readList( callback ) {
                crud.readAll( callback );
            };

        if( !_.has( crud, "readForeignKey" ) )
            crud.readForeignKey = function _baseCrud_readList( callback ) {
                crud.readAll( callback );
            };

        /* already set in sqlCrud, but missing rdb cruds like users */
        _.defaults( crud, {
            foreignName: "name",
            foreignNameSeparator: " "
        });

        return crud;
    }

    /* make website-based crud website unaware */
    function unPrefix( crud ) {

        //var unCrud = {
        //    create, update, del( key )
        //    copy all non-functions?
        //    clone all?
        //}

        /* references to original crud */
        //var create  = crud.create;
        //var read    = crud.read;
        //var readAll = crud.readAll;
        //var update  = crud.update;
        //var del     = crud.del;

        var unCrud = _.clone( crud );

        return function _unPrefixCrud( req ){

            var website = req.kern.website;

            /* wrap methods and supply website */
            /* fixthis: extend overrides original crud, return copy instead! */
            return _.extend( unCrud, {
                create: function _unPrefixCrud_create( obj, callback ) {
                    crud.create( website, obj, callback );
                },
                read:   function _unPrefixCrud_read( key, callback ) {
                    crud.read( website, key, callback );
                },
                readAll:function _unPrefixCrud_readAll( callback ) {
                    crud.readAll( website, callback );
                },
                update: function _unPrefixCrud_update( key, obj, callback ) {
                    crud.update( website, key, obj, callback );
                },
                del:    function _unPrefixCrud_del( key, callback ) {
                    crud.del( website, key, callback );
                }
            } );

            //return _.extend( crud, {
            //    create: function _unPrefixCrud_create() {
            //       create.apply(   crud, [ req.kern.website ].concat( Array.prototype.slice.call(arguments) ) );
            //    },
            //    read:   function _unPrefixCrud_read() {
            //       read.apply(     crud, [ req.kern.website ].concat( Array.prototype.slice.call(arguments) ) );
            //    },
            //    readAll:function _unPrefixCrud_readAll() {
            //       readAll.apply(  crud, [ req.kern.website ].concat( Array.prototype.slice.call(arguments) ) );
            //    },
            //    update: function _unPrefixCrud_update() {
            //       update.apply(   crud, [ req.kern.website ].concat( Array.prototype.slice.call(arguments) ) );
            //    },
            //    del:    function _unPrefixCrud_del() {
            //       del.apply(      crud, [ req.kern.website ].concat( Array.prototype.slice.call(arguments) ) );
            //    }
            //});

        };
    };

    /* wrapper to unPrefix and base a crud, allows to use crud by just calling it with reg as argument */
    function unPrefixBase( crud ) {
        var unprefixedCrud = unPrefix( crud );
        return function _unPrefixBase( req ) {
            return base( unprefixedCrud( req ) );
        }
    }

    function fieldManager( opts ) {
        opts = _.extend( {
            id: "id",
            idField: opts.id || "id",
            filters: {
                date:       "dateTime",
                email:      "email",
                number:     "decimal",
                enum:       "alnum",
                tel:        "telephone",
                text:       "text",
                foreign:    "uint",
                textarea:   "text",
                checkbox:   "exists",
                password:   "passwords",
                h3:         "drop",
                h4:         "drop"
            },
            elements: {
                date:       "date-field",
                email:      "email-field",
                enum:       "enum-field",
                foreign:    "foreign-field",
                number:     "number-field",
                tel:        "tel-field",
                text:       "text-field",
                textarea:   "textarea-field",
                checkbox:   "checkbox-field",
                password:   "password-field",
                h3:         "h3",
                h4:         "h4"
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
                var fields = _.isFunction( opts.fields ) ? opts.fields( req ) : opts.fields;
                _.each( fields, function( fieldOpts, field ) {
                    var source = fieldOpts.source || "postman";
                    var filterName = fieldOpts.filter || opts.filters[ fieldOpts.type ] || field;

                    if( !_.has( k.filters, filterName ) && filterName != 'exists' && filterName != 'get' && filterName != 'drop' && filterName != 'passwords' )
                        throw new Error( "CRUD: Undefined Filter >" + filterName + "< (field:" + field + ")" );

                    //console.log( "FILTER:", source, filterName, field );

                    /* drop value */
                    if( filterName == 'drop' )
                        return;
                    /* get value without applying any filter (for sources which do not support filters) */
                    else if( filterName == 'get' )
                        values[ field ] = req[ source ][ fieldOpts.name || field ];
                    /* fetch value using filters */
                    else if( filterName == 'passwords' ) {
                        var password = req[source].password( field );
                        if( password && password.length > 0 )
                        {
                            if( !req.postman.fieldsMatch( field, field + "2" ) )
                                throw req.locales.__( "Passwords do not match" );

                            if( password.length < k.users.minPasswordLength ) 
                                throw req.locales.__( "Password to short, minimum: {0}" ).format( k.users.minPasswordLength );

                            values[ field ] = password;
                        }
                    }
                    else
                        try {
                            values[ field ] = req[ source ][ filterName ]( fieldOpts.name || field );
                        }
                        catch( err ) {
                            /* attempt to resolve error to human readabletext */
                            if( typeof req[ source ] === "undefined" )
                                throw new Error( "readFields: unknown source '" + source + "'" );
                            if( typeof req[ source ][ filterName ] === "undefined" )
                                throw new Error( "readFields: unknown filtername '" + filtername + "' from source '" + source + "'" );
                            throw err;
                        }



                    /* local date format to iso */
                    if( fieldOpts.type == "date" )
                        values[ field ] = moment( values[ field ], req.locales.__( "date-format-moment" ) ).format("YYYY-MM-DD hh:mm:ss");
                });

                return values;
            },
            getRequestId: function( req ) {
                return req.requestman.escapedLink( opts.idField );
            }
        }, opts );

        return opts;
    }

    function crudManager( crud, opts ) {
        opts = fieldManager( opts );

        if( opts.unPrefix ) {
            opts = _.extend( opts, { unPrefixedCrud: unPrefixBase( crud ) } );
            opts = _.extend( opts, { getCrud: function _getCrudUnPrefixed( req ) {
                return opts.unPrefixedCrud( req );
            } });
        }
        else
            if( crud.type === "sql" )
                opts = _.extend( opts, { getCrud: function _getCrudSql( req ) {
                    /* overwrite sql-crud for this very call (bind req) */
                    return _.extend( {}, crud, {
                        read: function _crudManager_sql_read( key, callback ) {
                            crud.read( { req: req, key: key }, callback );
                        }
                    });
                } });
            else
                opts = _.extend( opts, { getCrud: function _getCrudPlain() {
                    return crud;
                } });

        return opts;
    }

    /* edit, TODO: remove crud.length ifs */
    function router( k, path, crud, opts ) {
        opts = crudManager( crud, opts );

        opts = _.extend( {
            preCreateTrigger: function( req, fields, crudCreate ) {
                crudCreate( fields );
            }
        }, opts );

        function handlePost( req, res, next )  {

            k.postman( req, res, function() {

                try {
                    if( req.postman.exists( "add" ) ) {
                        var obj = opts.readFields( req );

                        var handleCreate = function _handleCreate( err, data ) {
                            if( err )
                                return opts.__error( err, req, res, next );

                            var insertId = ( data || {} ).insertId;
                            req.messages.push( { type: "success", title: req.locales.__("Success"), text: req.locales.__("Item added"),
                                attributes: { "data-insert-id": insertId }
                            } );
                            opts.success( req, res, next );
                        };
                        
                        opts.preCreateTrigger( req, obj, function( obj ) {
                            opts.getCrud(req).create( obj, handleCreate );
                        });
                    }
                    else if( req.postman.exists( "update" ) ) {
                        var id = opts.getRequestId( req );
                        var obj = opts.readFields( req );

                        var handleUpdate = function _handleUpdate( err ) {
                            if( err )
                                return opts.__error( err, req, res, next );

                            req.messages.push( { type: "success", title: req.locales.__("Success"), text: req.locales.__("Item updated") } );
                            opts.success( req, res, next );
                        };

                        opts.getCrud(req).update( id, obj, handleUpdate );
                    }
                    else if( req.postman.exists( "delete" ) ) {
                        var id = req.postman.escapedLink( "delete" );

                        var handleDelete = function _handleDelete( err ) {
                            if( err )
                                return opts.__error( err, req, res, next );

                            req.messages.push( { type: "success", title: req.locales.__("Success"), text: req.locales.__("Item deleted") } );
                            opts.success( req, res, next );
                        };

                        opts.getCrud(req).del( id, handleDelete );
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
                var jadeFields =  {};
                var fields = _.isFunction( opts.fields ) ? opts.fields( req ) : opts.fields;

                _.each( fields, function( fieldOpts, field ) {
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
            crud: crud,
            getCrud: opts.getCrud
        };
    };

    /* linker: expose for AJAX */
    function linker( k, crud, opts ) {
        opts = crudManager( crud, opts );

        opts = _.extend( {
            id: "id",
            path: "/"
        }, opts);

        opts = _.extend( {
            readPath:       path.join( opts.path, "read/:id?"   ),
            idField:        "id",
            readAllPath:    path.join( opts.path, "read-all"    ),
            readListPath:   path.join( opts.path, "read-list"   ),
            createPath:     path.join( opts.path, "create"      ),
            updatePath:     path.join( opts.path, "update/:id?" ),
            deletePath:     path.join( opts.path, "delete/:id?" )
        }, opts);

        //var r = router( k, [ opts.createPath, opts.readPath, opts.updatePath, opts.deletePath ], crud, opts );
        //var r = express.Router();
        var r = k.router;

        function applyPostman( callback ) {
            return function( req, res, next ) {
                k.postman( req, res, function() {
                    callback( req, res, next );
                });
            };
        };

        r.get( opts.readPath, function( req, res, next ) {
            opts.getCrud(req).read( req.requestman.escapedLink( opts.idField ), function( err, data ) {
                if( err ) next( err ); else res.json( data );
            });
        });

        r.get( opts.readListPath, function( req, res, next ) {
            opts.getCrud(req).readList( function( err, data ) {
                if( err ) next( err ); else res.json( data );
            });
        });

        r.get( opts.readAllPath, function( req, res, next ) {
            opts.getCrud(req).readAll( function( err, data ) {
                if( err ) next( err ); else res.json( data );
            });
        });

        /* wheres, currently only supported for sql, if needed can be extended by handling readWhere in unPrefixedCrud */
        _.each( crud.wheres, function( where, name ) {

            var url = path.join( opts.path, "where", name );
            where.parameters.forEach( function( parameter ) {
                url = path.join( url, ":" + parameter.name );
            });

            r.get( url, function( req, res, next ) {

                var values = [];

                where.parameters.forEach( function( parameter ) {
                    values.push( req.requestman[ parameter.filter || "alnum" ]( parameter.name ) );
                });
                crud.readWhere( name, values, function( err, data ) {
                    if( err )
                        return next( err );

                    res.json( data );
                });
            });
        });

        if( !opts.readOnly ) {
            r.post( opts.createPath, applyPostman( function( req, res, next ) {
                opts.getCrud(req).create( opts.readFields( req ), function( err, data ) {
                    if( err ) next( err ); else res.json( { insertId: data.insertId } );
                });
            }) );
            

            r.post( opts.updatePath, applyPostman( function( req, res, next ) {
                var id = req.requestman.escapedLink( opts.idField );
                var data = opts.readFields( req );
                if( !id )
                    id = data[ opts.id ];

                opts.getCrud(req).update( id, data, function( err ) {
                    if( err ) next( err ); else res.json( {} );
                });
            }) );

            var deleteHandler = function _deleteHandler( req, res, next ) {
                var id = req.requestman.escapedLink( opts.idField );

                if( req.method != "GET" ) {
                    var data = opts.readFields( req );
                    if( !id )
                        id = data[ opts.id ];
                }
                
                opts.getCrud(req).del( id, function( err ) {
                    if( err ) next( err ); else res.json( {} );
                });
            }

            r.get ( opts.deletePath, deleteHandler );
            r.post( opts.deletePath, applyPostman( deleteHandler ) );
        }

    };

    function getOptional( k, optional, req ) {
        if( _.isBoolean( optional ) )
            return optional;

        if( _.has( optional, "permission" ) )
            return k.reg("admin").allowed( req, optional.permission );

        throw new Error( "CRUD unknown optional: " + optional.toString() );
    }

    function presenter( k, crud, opts ) {
        opts = _.extend( {
            id: "id",
            addPath: "/",
            title: "Crud",
            path: "/admin/crud",
            idField: "id",
            editPath: "/edit/:id?",
            jadeFile: "admin/crud",
            showAdd: true,
            showList: true
        }, opts);

        var r = router( k, [ opts.addPath, opts.editPath ], crud, opts );

        function renderAll( req, res, next, values, fullData ) {
            var renderCrud = r.getCrud( req );

            renderCrud.readList( function( err, items ) {
                if( err ) {
                    return next( err );
                }

                var fields = r.getFields( req );

                async.map( _.keys( renderCrud.foreignKeys ), function( fkey, done ) {

                    if( !_.has( fields, fkey ) )
                    {
                        console.log( "ForeignKey not registered: ".bold.red, fkey )
                        return done( new Error( "ForeignKey not registered: " + fkey ) );
                    }

                    /* check for unPrefix */
                    var foreignKey = renderCrud.foreignKeys[ fkey ];
                    var foreignCrud = foreignKey.crud;
                    if( foreignKey.unPrefix )
                        foreignCrud = unPrefixBase( foreignCrud )( req );

                    foreignCrud.readForeignKey( function( err, data ) {
                        if( err )
                            return done( err );

                        fields[ fkey ].items = data;
                        done();
                    }, renderCrud.foreignKeys[ fkey ] );

                }, function( err ) {
                    if( err )
                        return next( err );

                    var jadeCrudOpts = {
                        items: items,
                        idField: opts.id,
                        display: renderCrud.foreignName,
                        boldDisplay: renderCrud.foreignBoldName,
                        link: opts.path,
                        fields: fields,
                        scripts: opts.scripts || [],
                        values: r.getValues( req, fields, values ),
                        fullData: fullData,
                        formAction: req.baseUrl,
                        showList: getOptional( k, opts.showList, req ),
                        showAdd: opts.showAdd,
                        startExpanded: values ? false : (opts.startExpanded || false) /* do not start expanded in edit-mode */
                    };

                    k.jade.render( req, res, opts.jadeFile, k.reg("admin").values( req, { messages: req.messages, title: opts.title, opts: jadeCrudOpts } ) );
                });
            }, { req: req } );
        }

        k.router.get(opts.editPath, function( req, res, next ) {
            /* TODO: overwrite getCrud to set current req? */
            r.getCrud( req ).read( r.getRequestId( req ), function( err, data, fullData ) {
                if( err )
                    return next( err );

                /* no matching dataset, render "add" */
                if( _.isArray( data ) ) {
                    req.messages.push( { type: "danger", title: req.locales.__("Error"), text: req.locales.__( "Unknown ID" ) } );
                    renderAll( req, res, next );
                }
                /* dataset found, render "edit" */
                else
                    renderAll( req, res, next, data, fullData );
            });
        });

        if( opts.csvPath )
                k.router.get( opts.csvPath, function( req, res, next ) {
                    var fields = r.getFields( req );
                    var text = "", separator = "";
                    var keys = _.keys( fields );

                    /* header */
                    keys.forEach( function( field ) {
                        text += separator + field
                        separator = "\t"
                    });

                    /* values */
                    r.getCrud( req ).readList( function( err, items ) {
                        if( err ) return next( err );
                        items.forEach( function( row ) {
                            separator = "";
                            text += "\n";

                            keys.forEach( function( key ) {
                                var value = ( row[ key ] || "" ) + "";
                                value = value.replace( /"/g, '""' );
                                text += separator + '"' + value + '"';
                                separator = "\t";
                            });
                            
                        });
                        res.setHeader('Content-type', 'text/csv');
                        res.setHeader('Content-disposition', 'attachment;filename=Download.csv');
                        res.end( text );
                    });
                });

        k.router.get( opts.addPath, function( req, res, next ) {
            renderAll( req, res, next );
        });
    };

    return {
        setHash: setHash,
        setSet: setSet,
        sql: sqlCrud,
        router: router,
        linker: linker,
        presenter: presenter
    };
};
