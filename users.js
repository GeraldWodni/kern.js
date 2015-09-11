// User management
// (c)copyright 2014-2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var _           = require("underscore");
var async       = require("async");
var bcrypt      = require("bcrypt-nodejs");
var md5         = require("md5");
var nodemailer  = require("nodemailer");
var url         = require("url");

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

    function getQueueKey( prefix, id ) {
        return prefix + ":user-queue:" + id;
    }

    function getQueueNameKey( prefix, name ) {
        return prefix + ":user-queue-name:" + name;
    }

    function getQueueEmailKey( prefix, email ) {
        return prefix + ":user-queue-email" + email;
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

    function loadByEmail( prefix, email, next ) {
        readAll( prefix, function( err, users ) {
            if( err )
                return next( err );

            for( var i = 0; i < users.length; i++ )
                if( users[i].email == email )
                    return next( null, users[i] );

            next( null, null );
        });
    }

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

            var userRegistration = req.kern.getWebsiteConfig( "userRegistration", {} );

            /* already logged in, load user and resume */
            if( req.session && req.session.loggedInUsername ) {
                loadByName( req.kern.website, req.session.loggedInUsername, function( err, data ) {
                    if( err ) {
                        /* Login invalid, no matching user found. ( logged in user most likely changed his own name ) -> destroy session */
                        if( err.toString().indexOf( "Unknown user" ) >= 0 ) {
                            console.log( "Login invalid, destroy session".red.bold );
                            return req.sessionInterface.destroy( req, res, function() {
                                executeOrRender( req, res, next, loginRenderer, { register: userRegistration.enabled } );
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
                                return executeOrRender( req, res, next, loginRenderer, { error: err, register: userRegistration.enabled } );

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

                                var renderError = function _renderError( err ) {
                                    executeOrRender( req, res, next, loginRenderer, { error: err, register: userRegistration.enabled, hideLogin: true } );
                                }

                                /* check password */
                                var password = req.postman.password();
                                if( !req.postman.fieldsMatch( "password", "password2" ) )
                                    return renderError( req.locales.__( "Passwords do not match" ) );

                                if( password.length < minPasswordLength )
                                    return renderError( req.locales.__( "Password to short, minimum: {0}" ).format( minPasswordLength ) );

                                /* check if email exists */
                                var email = req.postman.email();
                                loadByEmail( req.kern.website, email, function( err, emailUser ) {
                                    if( err )
                                        return renderError( err );
                                    if( emailUser != null )
                                        return renderError( req.locales.__( "Email address already registered" ) );

                                    /* check registere-queue usersnames */
                                    var registerExpires = req.kern.getWebsiteConfig( "registerTimeout", 3600 );
                                    var usernameKey = getQueueNameKey( req.kern.website, username );
                                    k.rdb.set( [ usernameKey, 1, "NX", "EX", registerExpires ], function( err, key ) {
                                        if( err )
                                            return renderError( err );
                                        if( key != "OK" )
                                            return renderError( req.locales.__( "Username already in register-queue, please check your email" ) );

                                        /* check registere-queue emails */
                                        var emailKey = getQueueEmailKey( k.kern.website, email );
                                        k.rdb.set( [ emailKey, 1, "NX", "EX", registerExpires ], function( err, key ) {
                                            if( err )
                                                return renderError( err );
                                            if( key != "OK" ) {
                                                k.rdb.del( emailKey, function() {
                                                    renderError( req.locales.__( "Email already in register-queue, please check your email" ) );
                                                });
                                                return;
                                            }

                                            /* TODO: async.auto all of these */


                                            /* create register-hash */
                                            bcrypt.genSalt( 10, function( err, salt ) {
                                                if( err )
                                                    return renderError( err );

                                                var registerHash = md5( salt );


                                                /* save new user */
                                                //r.rdb.set( getQueueKey( req.kern.website, registerHash ), {
                                                //    user
                                                //

                                                //}, function( err ) {

                                                //    /* TODO: send email */
                                                //    var transporter

                                                //}

                                            });

                                            /* TODO: standard permissions */

                                            /* TODO: confirmation website which creates the real user */
                                            executeOrRender( req, res, next, loginRenderer, { error: err, register: userRegistration.enabled, hideLogin: true } );
                                        });


                                    });
                                });

                            }
                            else
                            /* user exists */
                                executeOrRender( req, res, next, loginRenderer, { error: req.locales.__("Username exists"), register: userRegistration.enabled, hideLogin: true } );
                        });
                    }
                    else
                        executeOrRender( req, res, next, loginRenderer, { register: userRegistration.enabled } );
                });
            /* show login form */
            else {
                executeOrRender( req, res, next, loginRenderer, { register: userRegistration.enabled } );
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
