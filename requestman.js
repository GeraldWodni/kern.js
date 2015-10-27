// handle request data
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

module.exports = function _requestman( k ) {

    return function requestman( req ) {
        /* register requestData fetcher */
        req.requestman = k.filters.fetch( function( field ) {
            return req.params[ field ];
        });
    };
}
