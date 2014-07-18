// User management
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var _       = require("underscore");

module.exports = function( rdb ) {

    function getKey( prefix, id ) {
        return prefix + ":user:" + id;
    }

    function getNamesKey( prefix ) {
        return prefix + ":usernames";
    }

    function save( obj, prefix, id ) {
        if( typeof prefix === "undefined" )
            prefix = obj[ "prefix" ];

        if( typeof id === "undefined" )
            id = obj[ "id" ];
        
        var userKey = getKey( prefix, id );

        _.map( obj, function( value, key ) {
            if( key != "id" && key != "prefix" )
                rdb.hset( userKey, key, value );
        });
    }

    function create( prefix, obj ) {
        var userCounter = prefix + ":users";

        rdb.incr( userCounter, function( err, userId ) {
            save( obj, prefix, userId );

            rdb.hset( getNamesKey( prefix ), obj[ "name" ], userId );
        });
    };

    function loadById( prefix, id, next ) {
        rdb.hgetall( getKey( prefix, id ), function( err, data ) {
            data = _.extend( data, { id: id, prefix: prefix } );
            next( err, data );
        });
    };

    function loadByName( prefix, name, next ) {
        rdb.hget( getNamesKey( prefix ), name, function( err, userId ) {
            if( err ) {
                next( err, null );
                return;
            }

            loadById( prefix, userId, next );
        });
    };

    var users = {
        create: create,
        save:   save,
        load:   loadByName
    };

    rdb.users = users;

    return users;
};
