// data manager - includes and merges all data.js files per website (primarily used for cruds)
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var mysql   = require("mysql");
var _       = require("underscore");

module.exports = function _data( k ) {
    var websites = {};

    function load( website ) {
        var files = k.hierarchy.paths( website, "data.js" ).reverse();
        var data = {};
        for( var i = 0; i < files.length; i++ ) {
            var file = require( "./" + files[i] );
            _.extend( data, file.setup( {
                rdb: k.rdb,
                users: k.users,
                crud: k.crud,
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
