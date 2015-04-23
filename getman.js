// handle get (query) - data
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

module.exports = function _getman( k ) {

    return function getman( req ) {
        /* register requestData fetcher */
        req.getman = k.filters.fetch( function( field ) {
            return req.query[ field ];
        });
    };
}
