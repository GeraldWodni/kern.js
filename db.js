// database adapter (mysql)
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

var mysql = require("mysql");

module.exports = function _db( k ) {
    var pools = {};

    function add( website, config ) {
        console.log( "MySql-Pool for ".bold.green, website );
        pools[ website ] = mysql.createPool( config );
    }

    function get( website ) {
        if( !(website in pools ) )
            throw new Error( "No MySql connection for website '" + website + "'" );

        return pools[ website ];
    }

    return {
        add: add,
        get: get
    }
}
