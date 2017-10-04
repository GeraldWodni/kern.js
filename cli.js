#! /usr/bin/env node
// Command line interface for basic redis setup (users)
// (c)copyright 2016 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

require("colors");
var _ = require("underscore");
var async  = require("async");
var fs     = require("fs");
var redis  = require("redis");
var bcrypt = require("bcrypt-nodejs");
var readline  = require("readline");
var Writable = require('stream').Writable;
var util   = require("util");
var rl =  readline.createInterface({ input: process.stdin, output: process.stdout });

var rdb;

function end() {
    if( rdb )
        rdb.quit();
    rl.close();
}


/* module specification */
var sections = {
    user: {
        list_websites: function() {
            rdb.keys( "*:users", function( err, websites ) {
                if( err ) return showErr( err );
                websites.forEach( function( website ) {
                    console.log( website.replace( /:.*$/g, "" ) );
                });
                end();
            });
        },
        import: function( website, params ) {
            var filename = params[0];
            var obj = JSON.parse( fs.readFileSync( filename ) + "" );
            console.log( obj );
            end();
        },
        export: function( website, params ) {
            var filename = params[0];
            var obj = { users: [] };
            rdb.multi()
                .get( website + ":users" )
                .hgetall( website + ":usernames" )
                .exec( function( err, results ) {
                    if( err ) return showErr( err );
                    obj.maxId = results[0];
                    var usernames = results[1];
                    obj.usernames = usernames;
                    async.map( _.keys(usernames), function( username, done ) {
                        var index = usernames[username];
                        rdb.hgetall( website + ":user:" + index, function( err, userObj ) {
                            if( err ) return done( err );
                            done( null, userObj );
                        });
                    }, function( err, results ) {
                        if( err) return showErr( err );
                        results.forEach( function( userObj ) {
                            obj.users.push( userObj );
                        });

                        var json = JSON.stringify(obj, null, 4);
                        if( filename )
                            fs.writeFileSync( filename, json );
                        else
                            console.log( json );

                        end();
                    });
                });
        },
        list: function( website, params ) {
            rdb.multi()
                .get( website + ":users" )
                .hgetall( website + ":usernames" )
                .exec( function( err, results ) {
                    if( err ) return showErr( err );
                    console.log( website +  ", maxId:", results[0] );
                    console.log( "#\tname\tpermissions".magenta );
                    var usernames = results[1];
                    async.map( _.keys(usernames), function( username, done ) {
                        var index = usernames[username];
                        rdb.hget( website + ":user:" + index, "permissions", function( err, perm ) {
                            if( err ) return done( err );
                            done( null, index + "\t" + username + "\t" + perm );
                        });
                    }, function( err, results ) {
                        if( err) return showErr( err );
                        console.log( results.join("\n") );
                        end();
                    });
                });
        },
        show: function( website, params ) {
            var username = params[0];
            getUserId( website, username, function( id ) {
                rdb.hgetall( website + ":user:" + id, function( err, user ) {
                    if( err ) return showErr( err );
                    _.each( user, function( val, key ) {
                        console.log( key.magenta, val );
                    });
                    end();
                });
            });
        },
        get: function( website, params ) {
            var username = params[0];
            var key = params[1];
            getUserId( website, username, function( id ) {
                rdb.hget( website + ":user:" + id, key, function( err, val ) {
                    if( err ) return showErr( err );
                    console.log( val );
                    end();
                });
            });
        },
        set: function( website, params ) {
            var username = params[0];
            var key = params[1];
            var val = params[2];
            if( key == "name" )
                return showErr( new Error( "user rename - is the command you want" ) );
            getUserId( website, username, function( id ) {
                rdb.hset( website + ":user:" + id, key, val, function( err ) {
                    if( err ) return showErr( err );
                    end();
                });
            });
        },
        rename: function( website, params ) {
            var username = params[0];
            var newname = params[1];
            getUserId( website, username, function( id ) {
                rdb.multi()
                    .hset( website + ":user:" + id, "name", newname )
                    .hdel( website + ":usernames", username )
                    .hset( website + ":usernames", newname, id )
                    .exec( function( err ) {
                        if( err ) return showErr( err );
                        end();
                    });
            });
        },
        del: function( website, params ) {
            var username = params[0];
            getUserId( website, username, function( id ) {
                rdb.multi()
                    .del( website + ":user:" + id )
                    .hdel( website + ":usernames", username )
                    .exec( function( err ) {
                        if( err ) return showErr( err );
                        end();
                    });
            });
        },
        /* TODO: delete all users before deleting the website itself */
        del_website: function( website, params ) {
            rdb.multi()
                .del( website + ":users" )
                .del( website + ":usernames" )
                .exec( function( err ) {
                    if( err ) return showErr( err );
                    end();
                });
        },
        del_key: function( website, params ) {
            var username = params[0];
            var key = params[1];
            getUserId( website, username, function( id ) {
                rdb.hdel( website + ":user:" + id, key, function( err ) {
                    if( err ) return showErr( err );
                    end();
                });
            });
        },
        passwd: function( website, params ) {
            var username = params[0];
            getUserId( website, username, function( id ) {
                setPassword( website, id );
            });
        },
        add_website: function( website ) {
            rdb.exists( website + ":users", function( err, exists ) {
                if( err ) return showErr( err );
                if( exists === 1 ) return showErr( new Error( "Websits exists" ) );
            });
        },
        add: function( website, params ) {
            var username = params[0];
            /* exists? */
            rdb.hget( website + ":usernames", username, function( err, userId ) {
                if( err ) return showErr( err );
                if( userId != null ) return showErr( new Error( "Username exists" ) );

                /* next id */
                rdb.incr( website + ":users", function( err, id ) {
                    rl.question( "Permissions: ", function( permissions ) {
                        /* skelleton */
                        rdb.hmset( website + ":user:" + id, {
                            name: username,
                            permissions: permissions
                        }, function( err ) {
                            if( err ) return showErr( err );
                            /* set id lookup */
                            rdb.hset( website + ":usernames", username, id, function( err ) {
                                if( err ) return showErr( err );
                                /* update password */
                                setPassword( website, id );
                            });
                        });
                    });
                });
            });
        }
    }
};

/* helpers */
function getUserId( website, username, callback ) {
    rdb.hget( website + ":usernames", username, function( err, id ) {
        if( err ) return showErr( err );
        if( id == null ) return showErr( new Error( "Unknown username: " + username ) );

        callback( id );
    });
}
/* query and set new password */
function setPassword( website, id ) {
    rl.close();
    /* explicit muted write stream  */
    function MutedStream(opts){
        if(!(this instanceof MutedStream))
            return new MutedStream(opts);
        Writable.call(this, opts);
    }
    util.inherits(MutedStream, Writable);
    MutedStream.prototype._write = function( chunk, encoding, callback ) { callback(); };
    var muted = new MutedStream();
    rl = readline.createInterface({ input: process.stdin, output: muted, terminal: true });

    muted.on("error", function( err ) {
        console.log( "readline-Error:", err.status, err.stack );
    });

    process.stdout.write( "Enter password" );
    rl.question( "Enter", function( pass1 ) {
        process.stdout.write( "\nRepeat password" );
        rl.question( "Enter", function( pass2 ) {
            if( pass1 != pass2 ) return showErr( new Error( "Passwords do not match"  ) );

            bcrypt.hash( pass1, null, null, function( err, passwordHash ) {
                if( err ) return showErr( err );
                rdb.hset( website + ":user:" + id, "passwordHash", passwordHash, function() {
                    if( err ) return showErr( err );
                    end();
                });
            });
                
        });
    });
}
function showErr( err ) {
    console.log( "ERROR".bold.red, err );
    end();
}
function toText( name ) {
    return name.replace( /_/g, '-' );
}
function toName( text ) {
    return text.replace( /-/g, '_' );
}

function usage() {
    console.log( "usage: " + process.argv[1] + " <section> <command> [website]");
    _.keys( sections ).forEach( function( section ) {
        var text = section.bold.magenta;
        _.keys( sections[ section ] ).forEach( function( command ) {
            text += " " + toText( command );
        });
        console.log( text );
        end();
    });
}

/* check parameters */
if( process.argv.length <= 3 )
    return usage();

var section = process.argv[2];
var command = toName( process.argv[3] );

if( !_.has( sections, section ) || !_.has( sections[ section ], command ) )
    return usage();

var website = process.argv.length > 4 ? process.argv[4] : "default";
var params  = process.argv.length > 5 ? process.argv.slice( 5 ) : [];

rdb = redis.createClient();
sections[ section ][ command ]( website, params );
