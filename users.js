// User management
// (c)copyright 2014-2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var _               = require("underscore");
var captcha         = require("ascii-captcha");
var async           = require("async");
var bcrypt          = require("bcrypt-nodejs");
var md5             = require("md5");
var nodemailer      = require("nodemailer");
var smtpTransport   = require("nodemailer-smtp-transport");
var url             = require("url");

module.exports = function _users( k ) {
    /* this keys are not stored in the database */
    var minPasswordLength = 4;
    var captchaTimeout = 1800;
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
        return prefix + ":user-queue-email:" + email;
    }

    function getCsrfKey( prefix, hash ) {
        return prefix + ":user-csrf:" + hash;
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

        /* if permissions are set separatly, ensure the field is present at user creation */
        if( ! obj.hasOwnProperty("permissions") )
            obj.permissions = "logout";

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
                        k.rdb.hset( getNamesKey( prefix ), obj[ "name" ], userId, function( err ) {
                            if( err )
                                next( err, null );
                            else
                                next( null, userId );
                        });
                    else
                        next( err, null );
                });
            });
        });
    };

    function getConfirmValues( prefix, hash, next ) {
        /* fetch queued user */
        var queueKey = getQueueKey( prefix, hash );
        k.rdb.hgetall( queueKey, function( err, obj ) {
            if( err )
                return next( err );
            if( !obj )
                return next( new Error( "Unknown hash" ) );
            next( null, obj );
        });
    }

    function deleteConfirmValues( prefix, hash, next ) {
        var queueKey = getQueueKey( prefix, hash );
        k.rdb.del( queueKey, function( err ){
            next( err );
        });
    }

    function confirmCreate( prefix, hash, next ) {
        getConfirmValues( prefix, hash, ( err, obj ) => {
            if( err )
                return next( err );

            /* create new user */
            create( prefix, obj, function( err, userId ) {
                if( err )
                    return next( err );

                /* delete queued item */
                deleteConfirmValues( prefix, hash, ( err ) => {
                    obj.id = userId;
                    next( err, obj );
                });
            });
        });
    }

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

    function changePasswordCallback( req, callback ) {
        const password = req.postman.password();
        if( !req.postman.fieldsMatch( "password", "password2" ) )
            callback( new Error( req.locales.__( "Passwords do not match" ) ) );
        else if( password.length < minPasswordLength )
            callback( new Error( req.locales.__( "Password too short, minimum length: {0}" ).format( minPasswordLength ) ) );
        else {
            bcrypt.hash( password, null, null, function( err, hash ) {
                if( err )
                    return callback( err, null );
                callback( null, hash );
            });
        }
    }

    function changePassword( req, res, next ) {
        k.postman( req, res, function() {
            changePasswordCallback( req, (err, passwordHash) => {
                if( err ) return next( err );

                var user = _.clone( req.user );
                user.password = req.postman.password()
                save( user, req.kern.website, user.id, next );
            });
        });
    }

    function login( prefix, name, password, opts, next ) {
        if( typeof opts === "function" ) {
            next = opts;
            opts = {};
        }
        _.defaults( opts, {
            loadByName: loadByName
        });
        opts.loadByName( prefix, name, function( err, data ) {
            if( err )
                return next( err, null );

            if( opts.assumePasswordCorrect )
                return next( null, data );

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

    /* Java's hashCode() implementation, Source: https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript */
    function stringHashCode( text ) {
        var hash = 0;
        if( !text.length ) return 0;

        for( var i = 0; i < text.length; i++ ) {
            var chr = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash|= 0; // Convert to 32bit integer
        }
        return hash;
    }

    /* TODO: save prefix in session to avoid cross-site hack-validation */
    /* loginRenderer: function( req, res ) or jade-filename */
    function loginRequired( loginRenderer, opts ) {
        var opts = opts || {};
        _.defaults( opts, {
            loadByName: loadByName
        });

        return function( req, res, next ) {

            /* skip authentication if path missmatch */
            if( opts.path && url.parse( req.url ).pathname.indexOf( opts.path ) != 0 ) {
                return next();
            }

            var userRegistration = Object.assign( {},  req.kern.getWebsiteConfig( "userRegistration", {} ) );
            _.defaults( userRegistration, {
                enabled: false,
                timeout: 1800,
                permissions: '',
                nameFilter: 'username',
                minimumNameLength: 3,
                link: "http://" + req.kern.website + "/confirm/{hash}",
                email: {
                    subject: "Registration",
                    text: "Please click the following link to complete your registration:\n{link}"
                }
            });
            if( opts.noUserRegistration )
                userRegistration.enabled = false;

            var captchaWord = captcha.generateRandomText(5);
            var csrf = md5( captcha.generateRandomText(32) );
            var captchaPre = '<pre style="font-size:3px;line-height:2px;">' + captcha.word2Transformedstr(captchaWord) + '</pre>';

            /* save csrf and captcha (which is only used for registration) */
            k.rdb.set( [ getCsrfKey( req.kern.website, csrf ), captchaWord, "EX", captchaTimeout ], function( err ) {
                console.log( "loginRequired:csrf", err );
                if( err )
                    return next( err );

                var vals = {
                    register: userRegistration.enabled,
                    captchaPre: captchaPre,
                    captchaHash: stringHashCode( captchaWord.toUpperCase() ),
                    minimumNameLength: userRegistration.minimumNameLength,
                    minPasswordLength: minPasswordLength,
                    csrf: csrf
                }

                if( opts.vals )
                    vals = opts.vals( req, vals );

                /* already logged in, load user and resume */
                if( req.session && req.session.loggedInUsername ) {
                    opts.loadByName( req.kern.website, req.session.loggedInUsername, function( err, data ) {
                        if( err ) {
                            /* Login invalid, no matching user found. ( logged in user most likely changed his own name ) -> destroy session */
                            if( err.toString().indexOf( "Unknown user" ) >= 0 ) {
                                console.log( "Login invalid, destroy session".red.bold, req.kern.website, req.session.loggedInUsername );
                                return req.sessionInterface.destroy( req, res, function() {
                                    executeOrRender( req, res, next, loginRenderer, vals );
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
                            login( req.kern.website, username, req.postman.password(), { loadByName: opts.loadByName }, function( err, data ) {
                                if( err )
                                    return executeOrRender( req, res, next, loginRenderer, _.extend( { error: err }, vals ) );

                                req.sessionInterface.start( req, res, async function() {
                                    req.session.loggedInUsername = username;
                                    req.session.loggedInUserId = data.id;
                                    req.session.loggedInPseudoId = await k.session.randomHash(); /* hint: use this for identifying the session rather than providing the real sid */
                                    req.user = data;
                                    req.method = "GET";
                                    next();
                                });
                            });
                        }
                        else if( userRegistration.enabled && req.postman.exists( ["register", "email", "username", "password", "password2"] ) ) {
                            if( !userRegistration.smtp )
                                return next( new Error( "UserRegistration: SMTP missing" ) );

                            /* read fields for writeback on error */
                            var form = {
                                username: req.postman[ userRegistration.nameFilter ]( "username" ),
                                email: req.postman.email()
                            };
                            if( userRegistration.extraFields ) {
                                userRegistration.extraFields.forEach( field => {
                                    form[ field.name ] = req.postman[ field.filter ]( field.name );
                                });
                                const EuCountries = [ "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden", "United Kingdom of Great Britain and Northern Ireland" ];
                                userRegistration.extraFields.forEach( field => {
                                    if( field.inferValue )
                                        switch( field.inferValue.type ) {
                                            case "constant":
                                                form[ field.name ] = field.inferValue.value;
                                                break;
                                            case "copy":
                                                form[ field.name ] = form[ field.inferValue.field ];
                                                break;
                                            case "vatAT":
                                                if( form.country == "Austria" )
                                                    form[ field.name ] = 20;
                                                else if( EuCountries.indexOf( form.country ) >= 0 ) {
                                                    if( ( form.vatId || "" ).length > 4 )
                                                        form[ field.name ] = 0;
                                                    else
                                                        form[ field.name ] = 20;
                                                }
                                                else
                                                    form[ field.name ] = 0;
                                                console.log( "VatAT Infer VALUE", form[ field.name ] );
                                        }
                                });
                            }

                            var results = {}
                            async.series([
                                function _captcha( callback ) {
                                    var sentCsrf = req.postman.alnum("csrf");
                                    var sentCaptcha = req.postman.alnum("captcha").toUpperCase();
                                    var csrfKey = getCsrfKey( req.kern.website, sentCsrf );
                                    k.rdb.get( csrfKey, function( err, storedCaptcha ) {

                                        if( err )
                                            callback( err );
                                        else
                                            k.rdb.del( getCsrfKey, function( err ) {
                                                if( sentCaptcha === storedCaptcha )
                                                    callback();
                                                else
                                                    callback( req.locales.__("Captcha not correct") );
                                            });
                                    });
                                },
                                function _username( callback ) {
                                    if( userRegistration.emailAsUsername )
                                        return callback();

                                    console.log( "AUTO", "username" );
                                    /* attempt to load user to check for existance */
                                    if( form.username.length < userRegistration.minimumNameLength )
                                        return callback( req.locales.__("Username too short, minimum length: {0}").format( userRegistration.minimumNameLength ) );

                                    opts.loadByName( req.kern.website, form.username, function( err, data ) {

                                        /* new user */
                                        if( err && err.message && err.message.indexOf( "Unknown user" ) == 0 ) {
                                            results.username = form.username;
                                            callback();
                                        }
                                        else
                                        /* user exists */
                                            callback( req.locales.__("Username exists")  );
                                    });
                                },
                                function _password( callback ) {
                                    console.log( "AUTO", "password" );
                                    /* check password */
                                    var password = req.postman.password();
                                    if( !req.postman.fieldsMatch( "password", "password2" ) )
                                        callback( req.locales.__( "Passwords do not match" ) );
                                    else if( password.length < minPasswordLength )
                                        callback( req.locales.__( "Password too short, minimum length {0}" ).format( minPasswordLength ) );
                                    else
                                        bcrypt.hash( password, null, null, function( err, passwordHash ) {
                                            if( err ) return callback( err );
                                            results.passwordHash = passwordHash;
                                            callback();
                                        });
                                },
                                function _email( callback )  {
                                    if( userRegistration.emailAsUsername )
                                        opts.loadByName( req.kern.website, form.email, function( err, emailUser ) {
                                            if( err && err.message && err.message.indexOf( "Unknown user" ) == 0 && emailUser == null ) {
                                                results.email = form.email;
                                                callback();
                                            }
                                            else if( err )
                                                callback( err );
                                            else {
                                                results.email = form.email;
                                                callback( req.locales.__( "Email address already registered" ) );
                                            }
                                        });
                                    else
                                        /* check if email exists */
                                        loadByEmail( req.kern.website, form.email, function( err, emailUser ) {
                                            console.log( "loadByEmail", "email" );
                                            if( err )
                                                callback( err );
                                            else if( emailUser != null )
                                                callback( req.locales.__( "Email address already registered" ) );
                                            else {
                                                results.email = form.email;
                                                callback();
                                            }
                                        });
                                },
                                function _usernameKey( callback ) {
                                    if( userRegistration.emailAsUsername )
                                        return callback();

                                    console.log( "AUTO", "usernameKey" );
                                    /* check registere-queue usersnames */
                                    var usernameKey = getQueueNameKey( req.kern.website, results.username );
                                    k.rdb.set( [ usernameKey, 1, "NX", "EX", userRegistration.timeout ], function( err, key ) {
                                        console.log( "AUTO", "usernameKey-resp", err, key );
                                        if( err )
                                            callback( err );
                                        else if( key != "OK" )
                                            callback( req.locales.__( "Username pending registration, please check your email" ) );
                                        else {
                                            results.usernameKey = usernameKey;
                                            callback();
                                        }
                                    });

                                },
                                function _emailKey( callback ) {
                                    console.log( "AUTO", "emailKey" );
                                    /* check registere-queue emails */
                                    var emailKey = getQueueEmailKey( req.kern.website, results.email );
                                    k.rdb.set( [ emailKey, 1, "NX", "EX", userRegistration.timeout ], function( err, key ) {
                                        console.log( "AUTO-RES", "emailKey", err, key );
                                        if( err )
                                            callback( err );
                                        else if( key != "OK" )
                                            callback( req.locales.__( "Email address already pending registration, please check your email" ) );
                                        else {
                                            results.emailKey = emailKey;
                                            callback();
                                        }
                                    });

                                },
                                function _hash( callback ) {
                                    console.log( "AUTO", "hash" );
                                    /* create register-hash */
                                    bcrypt.genSalt( 10, function( err, salt ) {
                                        if( err )
                                            callback( err );
                                        else {
                                            results.hash = md5( salt );
                                            callback();
                                        }
                                    });
                                },
                                function _queueKey( callback ) {
                                    console.log( "AUTO", "queueKey" );

                                    /* save new user */
                                    var queueKey = getQueueKey( req.kern.website, results.hash );

                                    var queueObj = {
                                        name:           results.username,
                                        email:          results.email,
                                        passwordHash:   results.passwordHash,
                                        permissions:    userRegistration.permissions
                                    };
                                    /* TODO: get filters from config or alike */

                                    if( userRegistration.extraFields )
                                        userRegistration.extraFields.forEach( field => {
                                            queueObj[ field.name ] = form[ field.name ];
                                        });

                                    k.rdb.hmset( queueKey, queueObj, function( err ) {
                                        if( err ) return callback( err );
                                        k.rdb.expire( queueKey, userRegistration.timeout, callback );
                                    });
                                },
                                function _sendEmail( callback ) {

                                    var link = userRegistration.link.replace( /{hash}/g, results.hash );
                                    if( req.protocol == "https" )
                                        link = link.replace(/^http:/, 'https:');
                                    results.link = link;

                                    console.log( "AUTO", "sendEmail" );
                                    /* send email */
                                    var emailTransport = nodemailer.createTransport( smtpTransport({
                                        host: userRegistration.smtp.host,
                                        port: userRegistration.smtp.port || 25,
                                        tls: {
                                            rejectUnauthorized: false
                                        },
                                        auth: {
                                            user: userRegistration.smtp.user,
                                            pass: userRegistration.smtp.password
                                        }
                                    }));

                                    var text = userRegistration.email.text
                                        .replace( /{link}/g, link )
                                        .replace( /{username}/g, results.username );

                                    emailTransport.sendMail({
                                        from: userRegistration.smtp.email,
                                        to: results.email,
                                        bcc: userRegistration.smtp.email,
                                        subject: userRegistration.email.subject,
                                        text: text
                                    }, callback );
                                }
                            ], function( err ){
                                console.log( "AUTO", "FIN", err, results );

                                /* clean up queue and render error */
                                var deleteKeys = [];
                                [ "usernameKey", "emailKey", "queueKey" ].forEach( function( keyName ) {
                                    if( keyName in results )
                                        deleteKeys.push( results[keyName] );
                                });

                                if( err )
                                    return k.rdb.del( deleteKeys, function() {
                                        executeOrRender( req, res, next, loginRenderer, _.extend( { error: err, hideLogin: true }, form, vals ) );
                                    });

                                console.log( "REGISTRATION COMPLETE!" );
                                var success = req.locales.__("Registration successful, please confirm your email address to activate your account");

                                if( userRegistration.skipEmailLink ) {
                                    console.log( "Redirect to confirmation link" );
                                    return res.redirect( results.link );
                                }

                                executeOrRender( req, res, next, loginRenderer, _.extend( { error: err, hideLogin: true, hideRegister: true, success: success }, vals ) );
                            });
                        }
                        else
                            executeOrRender( req, res, next, loginRenderer, vals );
                    });
                /* show login form */
                else {
                    executeOrRender( req, res, next, loginRenderer, vals );
                }

            }); /* end csrf safe */

        }; /* end login router */
    }; /* end login required */

    var users = {
        minPasswordLength: minPasswordLength,
        create: create,
        getConfirmValues: getConfirmValues,
        deleteConfirmValues: deleteConfirmValues,
        confirmCreate: confirmCreate,
        read:   loadById,
        readAll:readAll,
        /* TODO: remove ifs in crud to make this work!! */
        update: function( prefix, id, obj, callback ) {
            save( obj, prefix, id, callback );
        },
        changePasswordCallback: changePasswordCallback,
        changePassword: changePassword,
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
