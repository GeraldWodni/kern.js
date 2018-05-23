// websockets
// (c)copyright 2018 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

const url       = require( "url" );
const WebSocket = require( "ws"  );
const qs        = require( "qs"  );

module.exports = function _ws( k ) {

    var handlers = {}

    function getTarget( req ) {
        /* host */
        var fullUrl = url.parse( "http://" + req.headers.host + req.url );
        let website = k.hierarchy.website( fullUrl.hostname ) || "default";

        req.kern = {
            website: website,
            pathname: fullUrl.pathname
        }
        req.params = qs.parse( fullUrl.query );
    }

    const wss = new WebSocket.Server({ 
        server: k.server,
        /* 404 if handler is not set */
        verifyClient: function _wsVerifyClient( info, cb ) {
            getTarget( info.req );

            /* handler exist?  */
            let handlerUrl = info.req.kern.website + info.req.kern.pathname;
            if( handlers.hasOwnProperty( handlerUrl ) )
                cb( true, "", "" );
            else {
                console.log( "Unknown WebSocket Reqest:".bold.red, info.req.kern.website, info.req.kern.pathname );
                cb( false, 404, "No Handler" );
            }
        }
    });

    wss.on("connection", function _wsConnection( ws, req ) {
        console.log( "WebSocket Connection:".bold.yellow, req.kern.website, req.kern.pathname );
        let handlerUrl = req.kern.website + req.kern.pathname;

        handlers[ handlerUrl ]( ws, req );
    });

    return function _wsRegister( website, path, callback ) {
        console.log( "WebSocket Register".bold.yellow, path );
        handlers[ website + path ] = callback;
    };
};
