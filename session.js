// Session + Redis Store
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var crypto  = require("crypto");
var moment  = require("moment");
var _       = require("underscore");
var defaults = {
    cookie: "kernSession",
    externalCookie: "kernSessionExternal",
    timeout: 3000, /* in seconds */
    autostart: false
}

/* rdb: redis database */
module.exports = function _session( k, opts ) {

    opts = _.extend( defaults, opts );

    if( !( "key" in opts ) )
        opts.key = crypto.pseudoRandomBytes( 256 );

    if( process.env.KERN_SESSION_TIMEOUT ) {
        opts.timeout = process.env.KERN_SESSION_TIMEOUT;
        console.log( "Session-timeout-env:".bold.magenta, `${opts.timeout}s (${opts.timeout/60}min)` );
    }

    /* active sessions */
    function activeSessions( website, opts = {} ) {
        return new Promise( (fulfill, reject) => {
            k.rdb.keys( `session:${website}:*`, (err, sessionKeys) => {
                if( err ) return reject( err );

                const multi = k.rdb.multi();
                sessionKeys.forEach( sessionKey => multi.hgetall( sessionKey ) );
                sessionKeys.forEach( sessionKey => multi.ttl( sessionKey ) );
                /* fetch sessions */
                const now = new moment();
                multi.exec( (err, data ) => {
                    const sessions = data.slice( 0, data.length/2 );
                    const ttls = data.slice( data.length/2 );
                    if( err ) return reject( err );
                    for( var i = 0; i < sessions.length; i++ ) {
                        const lastActivity = moment( sessions[i]["session:activity"] );
                        sessions[i]["session:activityDuration"] = moment.utc( now.diff( lastActivity ) );
                        sessions[i]["session:ttl"] = ttls[i];
                        if( opts.addKey )
                            sessions[i]["session:key"] = sessionKeys[i];
                    }
                    fulfill( sessions );
                });
            });
        });
    }

    /* callback( randomaHashed ) */
    function randomHash( callback ) {
        crypto.pseudoRandomBytes(256, function( ex, buf) {
            var hash = crypto.createHmac( "sha256", opts.key );
            hash.update( buf );

            callback( hash.digest( "hex" ) );
        });
    }
    function pRandomHash() {
        return new Promise( (fulfill, reject) => {
            randomHash( fulfill );
        });
    }

    function sessionKey( req ) {
        return "session:" + req.kern.website + ":" + req.sessionId;
    }

    function setCookie( req, res ) {
        const cookieOpts = req.kern.getWebsiteConfig( "sessionCookies", { sameSite: 'strict' } );
        cookieOpts.httpOnly = true;
        cookieOpts.maxAge = opts.timeout * 1000;
        res.cookie( opts.cookie, req.sessionId, cookieOpts );
    }

    function setExternalCookie( req, res ) {
        console.log( "EXTERNAL COOKIE SETTYYYYYY!" );
        const cookieOpts = {
            sameSite: 'Lax',
            //secure: true,
            httpOnly: true,
            maxAge: opts.timeout * 1000
        };
        res.cookie( opts.externalCookie, req.sessionId, cookieOpts );
    }

    function start( req, res, next ) {
        if( typeof req.session !== "undefined" )
            return next( new Error( "Session already started" ) );

        console.log( "START session" );

        randomHash( function( id ) {
            req.sessionId = id;
            req.session = {
            }

            var key = sessionKey( req );
            k.rdb.hset( key, "session:started", moment().format( "YYYY-MM-DD hh:mm:ss" ) );
            k.rdb.expire( key, opts.timeout );

            setCookie( req, res );
            next();
        });

    };

    function load( req, res, next ) {

        var key = sessionKey( req );
        k.rdb.expire( key, opts.timeout );
        setCookie( req, res );

        k.rdb.hgetall( key, function( err, values) {

            /* only assign a session containing data (i.e. cookie sent which does not match session) */
            if( values ) {
                req.session = values;
                req.session["session:activity"] = moment().format( "YYYY-MM-DD hh:mm:ss" );
            }
            //console.log( "LOAD session", req.sessionId );
            next();
        });
    };

    function save( req, res, next ) {
        /* start saving the session */
        if( req.session ) {
            //console.log( "SAVE session", req.sessionId );
            var sKey = sessionKey( req );
            _.map( req.session, function( value, key ) {
                k.rdb.hset( sKey, key, value );
            });
        }

        /* no need to wait for redis to finish */
        next();
    };

    async function destroyByPseudoId( website, pseudoId ) {
        const sessions = await activeSessions( website, { addKey: true } );

        for( let session of sessions ) {
            if( session.loggedInPseudoId == pseudoId ) {
                await new Promise( (fulfill, reject) => k.rdb.del( session["session:key"], err => err ? reject(err) : fulfill() ) );
                return;
            }
        }
        throw new Error( `destroyByPseudoId: session with pseudoId ${pseudoId} in ${website} not found` );
    }

    function destroy( req, res, next ) {
        if( req.session ) {
            res.clearCookie( opts.cookie );
            res.clearCookie( opts.externalCookie );
            if( k.users.persistentLoginCookie )
                res.clearCookie( k.users.persistentLoginCookie );
            k.rdb.del( sessionKey( req ) );

            req.session = undefined;
        }

        next();
    }

    function destroyExternalCookie( req, res, next ) {
        if( req.session )
            res.clearCookie( opts.externalCookie );
    }

    function route() {
        k.app.use( function _route( req, res, next ) {

            /* add interface hooks */
            req.sessionInterface = {
                start: start,
                save: save,
                setExternalCookie,
                destroyExternalCookie,
                destroy: destroy
            }

            /* if kernSession-cookie exists, attempt to load session */
            if( req.cookies && opts.cookie in req.cookies ) {
                req.sessionId = req.cookies[ opts.cookie ];
                load( req, res, next );
            }
            /* external return? allow reload */
            else if( req.cookies && opts.externalCookie in req.cookies ) {
                console.log( "RESUME SESSION FROM external cookie".bold.cyan );
                req.sessionId = req.cookies[ opts.externalCookie ];
                load( req, res, next );
            }
            else if( opts.autostart )
                start( req, res, next );
            else
                next();
        });
    }

    function pushPostHook() {
        k.hooks.add( "post", function( req, res ) {
            /* save session (so there is one ) */
            /* TODO: store sessionId in req.sessionId? */
            if( req.sessionInterface )
                req.sessionInterface.save( req, res, function() {} ) 
        });
    }

    return {
        getActive: activeSessions,
        destroyByPseudoId,
        randomHash: pRandomHash,
        pushPostHook: pushPostHook,
        route: route
    }
}

