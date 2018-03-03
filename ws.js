// websockets
// (c)copyright 2018 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var WebSocket = require( "ws" );

module.exports = function _ws( k ) {

    const server = k.server;
    const wss = new WebSocket.Server({ server });

    wss.on("connection", function _wsConnection( ws, req ) {
        /* TODO: get matching website & path, decline otherwise */
        console.log( "WebSocket Connection".bold.yellow );
        ws.on("message", function _wsMessage( message ) {
            console.log( "WebSocket Message".bold.yellow, message );
            ws.send("got your message, thanks!");
            ws.close();
        });
        ws.on("error", function _wsError( err ) {
            console.log( "WebSocket Error".bold.red, err );
        });
    });

    return function _wsRegister( path, callback ) {
        /* TODO: get registering website */
        console.log( "WebSocket Register".bold.yellow, path );
    };
};
