// handle get (query) - data
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

const _         = require("underscore");

module.exports = function _getman( k ) {

    return function getman( req ) {
        /* register requestData fetcher */
        req.getman = _.extend( {
            exists: field => {
                /* allow passing of single value or array */
                if( ! _.isArray( field ) )
                    field = [ field ];
                return _.every( field, f => f in req.query );
            }
        },k.filters.fetch( function( field ) {
            return req.query[ field ];
        }));
    };
}
