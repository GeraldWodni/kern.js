// Session + Redis Store
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var crypto  = require("crypto");
var moment  = require("moment");
var _       = require("underscore");
var defaults = {
    cookie: "kernSession",
    timeout: 30
}

/* rdb: redis database */
function session( rdb, opts ) {

    opts = _.extend( defaults, opts );

    if( !( "key" in opts ) )
        opts.key = crypto.pseudoRandomBytes( 256 );

    /* callback( randomaHashed ) */
    function randomHash( callback ) {
        crypto.pseudoRandomBytes(256, function( ex, buf) {
            var hash = crypto.createHmac( "sha256", opts.key );
            hash.update( buf );

            callback( hash.digest( "hex" ) );
        });
    }

    function sessionKey( req, id ) {
        return "session:" + req.kern.website + ":" + id;
    }

    function start( req, res, next ) {
        if( typeof req.session !== "undefined" )
            throw "Session already started";

        randomHash( function( id ) {
            req.session = {
                id: id
            }

            var key = sessionKey( req, id );
            rdb.hset( key, "session:started", moment().format( "YYYY-MM-DD hh:mm:ss" ) );
            rdb.expire( key, opts.timeout );

            /* TODO: set cookie */

            next();
        });

    };

    function load( sessionId, req, res, next ) {
        /* TODO: refresh cookie */
        var key = sessionKey( req, sessionId );
        rdb.hset( key, "session:activiy", moment().format( "YYYY-MM-DD hh:mm:ss" ) );
        rdb.expire( key, opts.timeout );

        console.log( "Session loads '" + sessionId + "'" );
        next();
    };

    function save( req, res, next ) {
        /* start saving the session */
        if( req.session ) {
            
        }

        next();
    };

    return function( req, res, next ) {

        /* add interface hooks */
        req.sessionInterface = {
            start: start,
            save: save
        }

        /* if kernSession-cookie exists, attempt to load session */
        if( req.cookies && opts.cookie in req.cookies )
            load( req.cookies[ opts.cookie ], req, res, next );
        else
            start( req, res, next );
           // next();
    };
}

module.exports = session;

