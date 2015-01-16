// handle request data
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

function requestData( req ) {
    
    /* register requestData fetcher */
    req.requestData = req.fetchFilter( function( field ) {
        return req.params[ field ];
    });
}

module.exports = requestData;
