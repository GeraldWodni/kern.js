// database adapter (mysql)
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var mysql = require("mysql");
var _     = require("underscore");

module.exports = function _db( k ) {
    var pools = {};

    function add( website, config ) {
        console.log( "MySql-Pool for ".bold.green, website );
        /* apply custom format */
	var debugLog = config.debugLog || false;
        config.queryFormat = function _queryFormatter( query, values, timeZone ) { 
            return queryFormatter.call( this, query, values, timeZone, debugLog );
        }

        if( process.env.MYSQL_HOST ) {
            config.host = process.env.MYSQL_HOST;
            console.log( "Mysql-host-env:".bold.magenta, config.host );
        }
        if( process.env.MYSQL_PORT ) {
            config.port = process.env.MYSQL_PORT;
            console.log( "Mysql-port-env:".bold.magenta, config.port );
        }
        if( process.env.MYSQL_DATABASE ) {
            config.database = process.env.MYSQL_DATABASE;
            console.log( "Mysql-host-env:".bold.magenta, config.database );
        }
        if( process.env.MYSQL_USER ) {
            config.user = process.env.MYSQL_USER;
            console.log( "Mysql-user-env:".bold.magenta, config.user );
        }
        if( process.env.MYSQL_PASSWORD ) {
            config.password = process.env.MYSQL_PASSWORD;
            console.log( "Mysql-password-env:".bold.magenta, config.password.replace(/./g, '*') );
        }
        const pool = mysql.createPool( config );
        pool.pQuery = function() {
            const args = Array.from( arguments );
            return new Promise( (fulfill, reject) => {
                args.push( ( err, data ) => {
                    if( err ) return reject( err );
                    fulfill( data );
                });
                pool.query.apply( pool, args );
            });
        }
        pool.pTransaction = function() {
            return new Promise( ( fulfill, reject ) => {
                pool.getConnection( function( err, connection ) {
                    if( err ) {
                        if( connection && connection.release )
                            connection.release();
                        return reject( err );
                    }

                    var aborted = false;
                    function abortTransaction() {
                        if( aborted ) /* avoid double-abort */
                            return Promise.resolve();
                        aborted = true;

                        return new Promise( ( fulfillAbort, rejectAbort ) => {
                            connection.rollback( () => {
                                connection.release();
                                fulfillAbort();
                            });
                        });
                    }

                    function commitTransaction() {
                        return new Promise( (fulfill, reject) => {
                            connection.commit( err => {
                                if( err ) return abortTransaction().then( () => reject( err ) );
                                connection.release();
                                fulfill();
                            });
                        });
                    }

                    connection.beginTransaction( err => {
                        if( err ) {
                            connection.release();
                            return reject( err );
                        }

                        fulfill({
                            abort:  abortTransaction,   /* expose to abort for non sql releated errors */
                            commit: commitTransaction,
                            connection,
                            pQuery: function() {        /* modified pQuery which automatically rolls back */
                                const args = Array.from( arguments );
                                return new Promise( (fulfill, reject) => {
                                    args.push( ( err, data ) => {
                                        if( err ) return abortTransaction().then( reject( err ) );
                                        fulfill( data );
                                    });
                                    connection.query.apply( connection, args );
                                });
                            },
                        });
                    })

                });
            });
        }
        pools[ website ] = pool;
    }

    function get( website, nullOnError = false ) {
        if( !(website in pools ) )
            if( nullOnError )
                return null;
            else
                throw new Error( "No MySql connection for website '" + website + "'" );

        return pools[ website ];
    }

    /* custom query formatting */
    function queryFormatter( query, values, timeZone, debugLog ) {
        if( values == null )            /* nothing to replace */
            return query;

        var indexedValues = true;       /* find indexedValues if any */
        var obj = null;                 /* initially empty lookup object */
        if( !_.isArray( values ) ) {
            obj = values;
            if( _.has( values, "values" ) )
                values = obj.values;
            else
                indexedValues = false;
        }

        if( debugLog )
            console.log( "Q:".bold.red, query, values );

        var regex = /{#?([$_.a-zA-Z0-9]+)}|\?\??/g;
        var chunkIndex = 0;
        var valueIndex = 0;
        var result = '';
        var match;

        while( match = regex.exec( query ) ) {
            var value = '#UNKNOWN_VALUE#';

            /* indexed attribute(s) */
            if( match[0][0] == '?' ) {
                if( !indexedValues ) {
                    /* pass single object directly */
                    if( valueIndex++ == 0 )
                        value = this.escape( values, this.config.stringifyObjects, timeZone );
                    else
                        throw "queryFormatter: Indexed values must be served either a values array or the base object must contain a key named values";
                }
                else if( valueIndex >= values.length )
                    throw "queryFormatter: Indexed values out of bounds!";
                /* indexed key(s) */
                else if( match[0] == '??' )
                    value = mysql.escapeId( values[ valueIndex++ ] );
                /* indexed value(s) */
                else if( match[0] == '?' )
                    value = this.escape( values[ valueIndex++ ], this.config.stringifyObjects, timeZone );
            }
            else {
                value = k.rdb.getField( obj, match[1] );
                /* object as key */
                if( match[0][1] == '#' )
                    value = mysql.escapeId( value );
                /* object as value */
                else
                    value = this.escape( value, this.config.stringifyObjects, timeZone );
            }

            /* add value to result */
            result += query.slice( chunkIndex, match.index ) + value;
            chunkIndex = regex.lastIndex;
        }

        if( chunkIndex == 0 )           /* nothing has been replaced */
            return query;

        if( chunkIndex < query.length ) /* remaining chunk */
            result += query.slice( chunkIndex );

        if( debugLog )
            console.log( "A:".bold.green, result );

        return result;
    }

    return {
        add: add,
        get: get
    }
}
