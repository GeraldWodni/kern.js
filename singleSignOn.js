/* Signe Sign On */
/* (c)copyright 2020 by Gerald Wodni <gerald.wodni@gmail.com> */
"use strict";

module.exports = {
    setup: function( k ) {

        /* TODO: check login by real loginRequired without render? */
        k.router.get("/", ( req, res, next ) => {} );

        /* TODO: catchall for custom 404? */
        k.router.get("/*", function( req, res, next ) );
    }
};
