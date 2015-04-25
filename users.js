// User management
// (c)copyright 2014-2015 by Gerald Wodni <gerald.wodni@gmail.com>

var _       = require("underscore");
var async   = require("async");
var bcrypt  = require("bcrypt-nodejs");
var url     = require("url");

module.exports = function _users( k ) {
    /* this keys are not stored in the database */
    var minPasswordLength = 4;
    var forbiddenKeys = [ "id", "prefix", "password" ];

    function getKey( prefix, id ) {
        return prefix + ":user:" + id;
    }

    function getNamesKey( prefix ) {
        return prefix + ":usernames";
    }

    function saveObject( userKey, obj, next ) {
        obj = _.omit( obj, forbiddenKeys );
        k.rdb.hmset( userKey, obj, next );
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
            k.rdb.hgetall( namesKey, function( err, names ) {
                
                async.mapSeries( _.keys( names ), function _users_save_updateName_map( name, d ) {
                    /* delete namekeys with same id but different name (hence allow renaming) */
                    if( names[ name ] == id && name != obj.name )
                        k.rdb.hdel( namesKey, name, d );
                    else
                        d( null );
                },
                function _users_save_updateName_set( err ){
                    if( err )
                        return next( err );

                    /* set (new) name */
                    k.rdb.hset( namesKey, obj.name, id, next );
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
        k.rdb.hget( getNamesKey( prefix ), name, function( err, userId ) {
            if( err )
                return next( err, null );

            if( userId != null )
                return next( "Username exists", null );

            k.rdb.incr( userCounter, function( err, userId ) {
                save( obj, prefix, userId, function( err ) {
                    if( !err )
                        k.rdb.hset( getNamesKey( prefix ), obj[ "name" ], userId, next );
                    else
                        next( err, null );
                });
            });
        });
    };

    function loadById( prefix, id, next ) {
        k.rdb.hgetall( getKey( prefix, id ), function( err, data ) {
            data = _.extend( data, { id: id, prefix: prefix } );
            next( err, data );
        });
    };

    function loadByName( prefix, name, next ) {
        console.log( "Load user".grey, prefix.green, name.cyan );
        k.rdb.hget( getNamesKey( prefix ), name, function( err, userId ) {
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
        k.rdb.hgetall( getNamesKey( prefix ), function( err, data ) {
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
            k.jade.render( req, res, renderer, locals );
    }

    /* TODO: save prefix in session to avoid cross-site hack-validation */
    /* loginRenderer: function( req, res ) or jade-filename */
    function loginRequired( loginRenderer, opts ) {
        var opts = opts || {};

        return function( req, res, next ) {

            /* skip authentication if path missmatch */
            if( opts.path && url.parse( req.url ).pathname.indexOf( opts.path ) != 0 ) {
                return next();
            }

            var register = req.kern.getWebsiteConfig( "register", false );

            /* already logged in, load user and resume */
            if( req.session && req.session.loggedInUsername ) {
                loadByName( req.kern.website, req.session.loggedInUsername, function( err, data ) {
                    if( err ) {
                        /* Login invalid, no matching user found. ( logged in user most likely changed his own name ) -> destroy session */
                        if( err.toString().indexOf( "Unknown user" ) >= 0 ) {
                            console.log( "Login invalid, destroy session".red.bold );
                            return req.sessionInterface.destroy( req, res, function() {
                                executeOrRender( req, res, next, loginRenderer, { register: register } );
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
                k.postman( req, res, function() {
                    /* all fields available? */
                    if( req.postman.exists( ["login", "username", "password"] ) ) {
                        var username = req.postman.username();
                        console.log( "Login: ", username );
                        login( req.kern.website, username, req.postman.password(), function( err, data ) {
                            if( err )
                                return executeOrRender( req, res, next, loginRenderer, { error: err, register: register } );

                            req.sessionInterface.start( req, res, function() {
                                req.session.loggedInUsername = username;
                                req.user = data;
                                req.method = "GET";
                                next();
                            });
                        });
                    }
                    else if( req.postman.exists( ["register", "email", "username", "password", "password2"] ) ) {
                        var username = req.postman.username();

                        /* attempt to load user to check for existance */
                        loadByName( req.kern.website, username, function( err, data ) {

                            /* new user */
                            if( err && err.message && err.message.indexOf( "Unknown user" ) == 0 ) {
                                err = undefined;

                                var password = req.postman.password();
                                if( !req.postman.fieldsMatch( "password", "password2" ) )
                                    err = req.locales.__( "Passwords do not match" );

                                if( password.length < minPasswordLength ) 
                                    err = req.locales.__( "Password to short, minimum: {0}" ).format( minPasswordLength );

                                /* TODO: check if email exists */
                                /* TODO: check registere-queue usersnames */
                                /* TODO: check registere-queue emails */
                                /* TODO: write to redis with TTL */
                                /* TODO: standard permissions */
                                /* TODO: send email */

                                /* TODO: confirmation website which creates the real user */


                                executeOrRender( req, res, next, loginRenderer, { error: err, register: register, hideLogin: true } );
                            }
                            else
                            /* user exists */
                                executeOrRender( req, res, next, loginRenderer, { error: req.locales.__("Username exists"), register: register, hideLogin: true } );
                        });
                    }
                    else
                        executeOrRender( req, res, next, loginRenderer, { register: register } );
                });
            /* show login form */
            else {
                executeOrRender( req, res, next, loginRenderer, { register: register } );
            }
        };
    };

    var users = {
        minPasswordLength: minPasswordLength,
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
        login:  login,
        loginRequired: loginRequired
    };

    /* TODO: document examples below */
    //k.users.create( "wodni.at", { name: "test", password: "1234", value: "23" }, function( err ) { console.log( "User-Create Err:", err ) } );
    //k.users.load( "wodni.at", "gerald", function( err, data ) {
    //    console.log( "User-Load Err:", err, "Data:", data );
    //});
    //k.users.create( "default", { name: "gerald", password: "1234" }, function( err ) { console.log( "User-Create Err:", err ) } );

    //app.use( k.users.loginRequired( function( req, res, next ) {
    //    app.renderJade( res, req.kern.website, "admin/login" );
    //}) );

    return users;
};
