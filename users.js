// User management
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var _       = require("underscore");
var bcrypt  = require("bcrypt-nodejs");

module.exports = function( rdb ) {
    /* this keys are not stored in the database */
    var forbiddenKeys = [ "id", "prefix", "password" ];

    function getKey( prefix, id ) {
        return prefix + ":user:" + id;
    }

    function getNamesKey( prefix ) {
        return prefix + ":usernames";
    }

    function saveObject( userKey, obj, next ) {
        obj = _.omit( obj, forbiddenKeys );
        rdb.hmset( userKey, obj, next );
    }

    function save( obj, prefix, id, next ) {
        if( typeof prefix === "undefined" )
            prefix = obj[ "prefix" ];

        if( typeof id === "undefined" )
            id = obj[ "id" ];
        
        var userKey = getKey( prefix, id );

        if( "password" in obj )
            bcrypt.hash( obj[ "password" ], null, null, function( err, hash ) {
                if( err )
                    return next( err, null );

                obj[ "passwordHash" ] = hash;
                saveObject( userKey, obj, next );
            });
        else
            saveObject( userKey, obj, next );
    }

    function create( prefix, obj, next ) {
        var userCounter = prefix + ":users";

        var name = obj[ "name" ];
        rdb.hget( getNamesKey( prefix ), name, function( err, userId ) {
            if( err )
                return next( err, null );

            if( userId != null )
                return next( "Username exists", null );

            rdb.incr( userCounter, function( err, userId ) {
                save( obj, prefix, userId, function( err ) {
                    if( !err )
                        rdb.hset( getNamesKey( prefix ), obj[ "name" ], userId, next );
                    else
                        next( err, null );
                });
            });
        });
    };

    function loadById( prefix, id, next ) {
        console.log( "loadById", prefix, "ID:", id );
        rdb.hgetall( getKey( prefix, id ), function( err, data ) {
            data = _.extend( data, { id: id, prefix: prefix } );
            next( err, data );
        });
    };

    function loadByName( prefix, name, next ) {
        rdb.hget( getNamesKey( prefix ), name, function( err, userId ) {
            if( err )
                return next( err, null );

            if( userId == null )
                return next( "Unknown user '" + name + "'", null );

            loadById( prefix, userId, next );
        });
    };

    function login( prefix, name, password, next ) {
        loadByName( prefix, name, function( err, data ) {
            if( err )
                return next( err, null );

            bcrypt.compare( password, data.passwordHash, function( err, correct ) {
                if( err )
                    return next( err, null );

                if( !correct )
                    return next( "Incorrect credentials", null );

                next( false, data );
            });
        });
    };

    function loginRequired( loginRenderer ) {
        return function( req, res, next ) {
            if( req.session && req.session.loggedInUsername )
                loadByName( req.session.loggedInUsername, function( err, data ) {
                    if( err )
                        return next( err, null );

                    req.user = data;
                    return next();
                });

            loginRenderer( req, res, next );
        };
    };

    var users = {
        create: create,
        save:   save,
        load:   loadByName,
	login:	login,
        loginRequired: loginRequired
    };

    rdb.users = users;

    return users;
};
