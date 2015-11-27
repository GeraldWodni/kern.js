// data manager - includes and merges all data.js files per website (primarily used for cruds)
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var mysql   = require("mysql");
var moment  = require("moment");
var _       = require("underscore");

module.exports = function _data( k ) {
    var websites = {};

    var dateTimeFormat = 'YYYY-MM-DD HH:mm:ss';
    function load( website ) {
        var files = k.hierarchy.paths( website, "data.js" ).reverse();
        var data = {
            sql: {
                dateTimeFormat: dateTimeFormat,
                now:    function() { return moment().format( dateTimeFormat );          },
                nowUtc: function() { return moment().utc().format( dateTimeFormat );    }
            }
        };
        for( var i = 0; i < files.length; i++ ) {
            var file = require( "./" + files[i] );
            _.extend( data, file.setup( {
                rdb: k.rdb,
                users: k.users,
                crud: k.crud,
                hierarchyData: data,
                getDb: function() {
                    return k.db.get( website );
                }
            }) );
        }

        websites[ website ] = data;
    }

    function get( website ) {
        if( !(website in websites ) )
            throw new Error( "No Data found for website '" + website + "'" );

        return websites[ website ];
    }

    return {
        load: load,
        get: get
    }
}
