// User management
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var _       = require("underscore");
var bcrypt  = require("bcrypt-nodejs");

var postman = require("./postman");

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

    function executeOrRender( req, res, next, renderer, locals ) {
        if( typeof loginRenderer === "function" )
            loginRenderer( req, res, next, locals );
        else
            req.kern.renderJade( res, req.kern.website, renderer, locals );
    }

    /* TODO: save prefix in session to avoid cross-site hack-validation */
    /* loginRenderer: function( req, res ) or jade-filename */
    function loginRequired( loginRenderer ) {
        return function( req, res, next ) {
            /* already logged in, load user and resume */
            if( req.session && req.session.loggedInUsername ) {
                loadByName( req.kern.website, req.session.loggedInUsername, function( err, data ) {
                    if( err )
                        return next( err, null );

                    req.user = data;
                    next();
                });
                return;
            }

            /* check for credentials */
            if( req.method === "POST" )
                postman( req, res, function() {
                    /* all fields available? */
                    if( req.postman.exists( ["login", "username", "password"] ) ) {
                        var username = req.postman.username();
                        login( req.kern.website, username, req.postman.password(), function( err, data ) {
                            if( err )
                                return executeOrRender( req, res, next, loginRenderer, { error: err } );

                            req.sessionInterface.start( req, res, function() {
                                req.session.loggedInUsername = username;
                                req.user = data;
                                next();
                            });
                        });
                    }
                    else
                        executeOrRender( req, res, next, loginRenderer );
                });
            /* show login form */
            else {
                executeOrRender( req, res, next, loginRenderer );
            }
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
