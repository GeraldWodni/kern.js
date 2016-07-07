// database adapter (mysql)
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var mysql = require("mysql");
var _     = require("underscore");

module.exports = function _db( k ) {
    var pools = {};

    function add( website, config ) {
        console.log( "MySql-Pool for ".bold.green, website );
        config.queryFormat = queryFormatter;    /* apply custom format */
        pools[ website ] = mysql.createPool( config );
    }

    function get( website ) {
        if( !(website in pools ) )
            throw new Error( "No MySql connection for website '" + website + "'" );

        return pools[ website ];
    }

    /* custom query formatting */
    function queryFormatter( query, values, timeZone ) {
        if( values == null )            /* nothing to replace */
            return query;

        var indexedValues = true;       /* find indexedValues if any */
        var obj = null;                 /* initially empty lookup object */
        if( !_.isArray( values ) ) {
            if( _.has( values, "values" ) ) {
                obj = values;
                values = obj.values;
            }
            else
                indexedValues = false;
        }


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
                if( !indexedValues )
                    throw "queryFormatter: Indexed values must be served either a values array or the base object must contain a key named values";
                if( valueIndex >= values.length )
                    throw "queryFormatter: Indexed values out of bounds!";
                /* indexed key(s) */
                if( match[0] == '??' )
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

        console.log( "A:".bold.green, result );

        return result;
    }

    return {
        add: add,
        get: get
    }
}
