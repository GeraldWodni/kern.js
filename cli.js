#! /usr/bin/env node
// Command line interface for basic redis setup (users)
// (c)copyright 2016-2019 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

require("colors");
var _ = require("underscore");
var async  = require("async");
var fs     = require("fs");
const path = require("path");
const spawn = require("child_process").spawn;
var redis  = require("redis");
var bcrypt = require("bcrypt-nodejs");
const moment = require("moment");
var readline  = require("readline");
var Writable = require('stream').Writable;
var util   = require("util");
var rl = null;
var out = console.log;
var webMode = false;

var rdb;

var end = function _end() {
    if( rdb )
        rdb.quit();
    if( rl )
        rl.close();
}

/* module specification */
var sections = {
    cache: {
        list: function() {
            rdb.keys( "cache:websites*", function( err, items ) {
                if( err ) return showErr( err );
                out( items.join( "\n" ) );
                end();
            });
        },
        del: function() {
            rdb.keys( "cache:websites*", function( err, items ) {
                if( err ) return showErr( err );
                rdb.del( items, function( err, count ) {
                    if( err ) return showErr( err );
                    out( count + " items deleted" );
                    end();
                });
            });
        },
        list2: function() {
            rdb.keys( "cache2:websites*", function( err, items ) {
                if( err ) return showErr( err );
                out( items.join( "\n" ) );
                end();
            });
        },
        del2: function() {
            rdb.keys( "cache2:websites*", function( err, items ) {
                if( err ) return showErr( err );
                rdb.del( items, function( err, count ) {
                    if( err ) return showErr( err );
                    out( count + " items deleted" );
                    end();
                });
            });
        }
    },
    user: {
        list_websites: function() {
            rdb.keys( "*:users", function( err, websites ) {
                if( err ) return showErr( err );
                websites.forEach( function( website ) {
                    out( website.replace( /:.*$/g, "" ) );
                });
                end();
            });
        },
        import: function( website, params ) {
            var filename = params[0];
            var content;
            if( filename == "--" )
                content = params[1];
            else
                content = fs.readFileSync( filename ).toString();
            var obj = JSON.parse( content );
            var multi = rdb.multi();

            var usernames = {};
            multi.set( website + ":users", obj.maxId );
            _.each( obj.users, function( userObj, userId ) {
                multi.hmset( website + ":user:" + userId, userObj );
                usernames[ userObj.name ] = userId;
            });
            multi.hmset( website + ":usernames", usernames );
            multi.exec( function( err ) {
                if( err ) return showErr( err );
                out( "Import successfull" );
                end();
            });
        },
        export: function( website, params ) {
            var filename = params[0];
            var obj = { users: {} };
            rdb.multi()
                .get( website + ":users" )
                .hgetall( website + ":usernames" )
                .exec( function( err, results ) {
                    if( err ) return showErr( err );
                    obj.maxId = results[0];
                    var usernames = results[1];
                    async.map( _.keys(usernames), function( username, done ) {
                        var index = usernames[username];
                        rdb.hgetall( website + ":user:" + index, function( err, userObj ) {
                            if( err ) return done( err );
                            obj.users[ index ] = userObj;
                            done( null );
                        });
                    }, function( err ) {
                        if( err) return showErr( err );

                        var json = JSON.stringify(obj, null, 4);
                        if( filename )
                            fs.writeFileSync( filename, json );
                        else
                            out( json );

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
                    out( website +  ", maxId:", results[0] );
                    out( "#\tname\tpermissions".magenta );
                    var usernames = results[1];
                    async.map( _.keys(usernames), function( username, done ) {
                        var index = usernames[username];
                        rdb.hget( website + ":user:" + index, "permissions", function( err, perm ) {
                            if( err ) return done( err );
                            done( null, index + "\t" + username + "\t" + perm );
                        });
                    }, function( err, results ) {
                        if( err) return showErr( err );
                        out( results.join("\n") );
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
                        out( key.magenta, val );
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
                    out( val );
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
            delUser( website, username, err => {
                if( err ) return showErr( err );
                end();
            });
        },
        /* TODO: delete all users before deleting the website itself */
        del_website: function( website, params ) {
            rdb.hgetall( website + ":usernames", function( err, usernames ) {
                if( err ) return showErr( err );

                var promise = Promise.resolve();
                _.keys(usernames).forEach( username =>
                    promise = promise.then( () => {
                        return new Promise( (fulfill, reject) =>
                            delUser( website, username, err => {
                                if( err ) return reject( err );
                                fulfill();
                            })
                        );
                    })
                );

                promise.then( () => {
                    rdb.multi()
                        .del( website + ":users" )
                        .del( website + ":usernames" )
                        .exec( function( err ) {
                            if( err ) return showErr( err );
                            end();
                        });
                });
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
        },
        active: function( website ) {
            if( website == "default" )
                website = "*";

            rdb.keys( `session:${website}:*`, (err, sessionKeys) => {
                if( err ) return showErr( err );

                const multi = rdb.multi();
                sessionKeys.forEach( sessionKey => multi.hgetall( sessionKey ) );
                /* fetch sessions */
                const now = new moment();
                multi.exec( (err, sessions ) => {
                    if( err ) return showErr( err );
                    for( var i = 0; i < sessions.length; i++ ) {
                        const lastActivity = moment( sessions[i]["session:activity"] );
                        const durationString = moment.utc( now.diff( lastActivity ) ).format("HH:mm:ss")
                        console.log( sessionKeys[i], sessions[i].loggedInUsername.bold.cyan, durationString.bold.green );
                    }
                    end();
                });
            });
        }
    },
    /* npm interface getting called by website-sync after startup sync */
    npm: {
        install: function( website ) {
            /* run npm as separate process to avoid getting killed by forever */
            spawn('npm', ['install'], {
                stdio: 'ignore',
                detached: true,
                cwd: path.join( "websites", website )
            }).unref();
            end();
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
function delUser( website, username, callback ) {
    getUserId( website, username, function( id ) {
        rdb.multi()
            .del( website + ":user:" + id )
            .hdel( website + ":usernames", username )
            .exec( function( err ) {
                callback( err );
            });
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
        out( "readline-Error:", err.status, err.stack );
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
    if( webMode ) {
        console.error( "ERROR(WEB)".bold.red, err );
        out( JSON.stringify({
            err: err,
            error: true,
            maxId: null,
            users: {}
        }, null, 4) );
    }
    else
        out( "ERROR".bold.red, err );
    end();
}
function toText( name ) {
    return name.replace( /_/g, '-' );
}
function toName( text ) {
    return text.replace( /-/g, '_' );
}

function usage( programName ) {
    out( "usage: " + programName + " <section> <command> [website]");
    _.keys( sections ).forEach( function( section ) {
        var text = section.bold.magenta;
        _.keys( sections[ section ] ).forEach( function( command ) {
            text += " " + toText( command );
        });
        out( text );
        end();
    });
}

function performQuery( argv ) {
    /* check parameters */
    if( argv.length <= 3 )
        return usage( argv[1] );

    var section = argv[2];
    var command = toName( argv[3] );

    if( !_.has( sections, section ) || !_.has( sections[ section ], command ) )
        return usage( argv[1] );

    var website = argv.length > 4 ? argv[4] : "default";
    var params  = argv.length > 5 ? argv.slice( 5 ) : [];

    var opts = { port: 6379 }; /* for some reason redis crashes with opts being an empty object */
    if( process.env.REDIS_HOST )
        opts.host = process.env.REDIS_HOST;
    rdb = redis.createClient(opts);
    rdb.on("error", showErr );

    sections[ section ][ command ]( website, params );
}

function cliWebserver( opts ) {
    const http = require("http");
    const URL = require("url");
    console.log( opts.secret );
    const server = http.createServer( (req, res) => {
        const url = URL.parse( req.url );


        var output = "";
        out = function() {
            output += Array.from( arguments ).join( " " );
        }

        end = function() {
            if( rdb )
                rdb.quit();
            res.end( output );
        }

        if( url.pathname.indexOf( "/" + opts.secret ) == 0 ) {
            var argv = url.pathname.split("/");
            argv[1] = "CLI";
            console.log( req.method );
            console.log( req.headers )

            console.log( "ARGV:", JSON.stringify( argv, null, 4 ) );
            if( req.method == "POST" ) {
                var data = "";
                req.on( "data", chunk => data+=chunk.toString() );
                req.on( "end", () => {
                    argv.push( data );
                    performQuery( argv );
                });
            }
            else
                performQuery( argv );
        }
        else {
            res.writeHead( 403 );
            console.log( "403:", url.pathname );
            return res.end( "CLI will fight you" );
        }
    });
    server.listen( opts.port );
}

/* main module? use argv */
if( require.main === module ) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    performQuery( process.argv );
}
/* otherwise export */
else {
    webMode = true;
    module.exports = cliWebserver;
}
