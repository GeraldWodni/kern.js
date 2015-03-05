// User management
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var _       = require("underscore");
var async   = require("async");
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
    console.log( "SAVE USER".bold.magenta );
        if( typeof prefix === "undefined" )
            prefix = obj[ "prefix" ];

        if( typeof id === "undefined" )
            id = obj[ "id" ];
        
        var userKey = getKey( prefix, id );

        console.log( "SAVE, OBJ:", arguments );

        /* update name in namesKey */
        function updateName( err ) {
            if( err )
                return next( err );

            /* find matching name key */
            var namesKey = getNamesKey( prefix );
            rdb.hgetall( namesKey, function( err, names ) {
                
                async.mapSeries( _.keys( names ), function _users_save_updateName_map( name, d ) {
                    /* delete namekeys with same id but different name (hence allow renaming) */
                    if( names[ name ] == id && name != obj.name )
                        rdb.hdel( namesKey, name, d );
                    else
                        d( null );
                },
                function _users_save_updateName_set( err ){
                    if( err )
                        return next( err );

                    /* set (new) name */
                    rdb.hset( namesKey, obj.name, id, next );
                });

            });

        }

        if( "password" in obj )
            bcrypt.hash( obj[ "password" ], null, null, function( err, hash ) {
                if( err )
                    return next( err, null );

                obj[ "passwordHash" ] = hash;
                saveObject( userKey, obj, updateName );
            });
        else
            saveObject( userKey, obj, updateName );
    }

    function create( prefix, obj, next ) {
        var userCounter = prefix + ":users";

        var name = obj[ "name" ];
        console.log( "Create new User".bold.green, getNamesKey( prefix ), name );
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
        console.log( "Load user".grey, prefix.green, name.cyan );
        rdb.hget( getNamesKey( prefix ), name, function( err, userId ) {
            if( err )
                return next( err, null );

            if( userId == null ) {
                if( prefix == "default" )
                   return next( new Error("Unknown user '" + name + "'"), null );
                else
                   loadByName( "default", name, next );
            }
            else
                loadById( prefix, userId, next );
        });
    };

    function readAll( prefix, next ) {
        rdb.hgetall( getNamesKey( prefix ), function( err, data ) {
            if( err )
                return next( err );

            async.map( _.values( data ), function( id, done ) {
                loadById( prefix, id, done );
            }, next );
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
        if( typeof renderer === "function" )
            renderer( req, res, next, locals );
        else
            req.kern.renderJade( req, res, renderer, locals );
    }

    /* TODO: save prefix in session to avoid cross-site hack-validation */
    /* loginRenderer: function( req, res ) or jade-filename */
    function loginRequired( loginRenderer ) {
        return function( req, res, next ) {
            /* already logged in, load user and resume */
            if( req.session && req.session.loggedInUsername ) {
                loadByName( req.kern.website, req.session.loggedInUsername, function( err, data ) {
                    if( err ) {
                        /* Login invalid, no matching user found. ( logged in user most likely changed his own name ) -> destroy session */
                        if( err.toString().indexOf( "Unknown user" ) >= 0 ) {
                            console.log( "Login invalid, destroy session".red.bold );
                            return req.sessionInterface.destroy( req, res, function() {
                                executeOrRender( req, res, next, loginRenderer );
                            });
                        }
                        else
                            return next( err, null );
                    }

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
			console.log( "Login: ", username );
                        login( req.kern.website, username, req.postman.password(), function( err, data ) {
                            if( err )
                                return executeOrRender( req, res, next, loginRenderer, { error: err } );

                            req.sessionInterface.start( req, res, function() {
                                req.session.loggedInUsername = username;
                                req.user = data;
                                req.method = "GET";
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
        minPasswordLength: 4,
        create: create,
        read:   loadById,
        readAll:readAll,
        /* TODO: remove ifs in crud to make this work!! */
        update: function( prefix, id, obj, callback ) {
            save( obj, prefix, id, callback );
        },
        del: function( prefix, id, callback ) {
            return callback( new Error( "users.del not implemented" ) );
        },
        save:   save,
        load:   loadByName,
	login:	login,
        loginRequired: loginRequired
    };

    rdb.users = users;

    return users;
};
