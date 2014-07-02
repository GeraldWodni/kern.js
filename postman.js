// Receive and handle post data
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var qs = require( "qs" );

function postman( req, res, callback ) {
    var body = '';
    req.on( 'data', function( data ) {
        body += data;

        /* abort on flooding-attack */
        if( body.length > 1e6 )
            req.connection.destroy();
    });

    req.on( "end", function() {
        var fields = qs.parse( body );

        var filter = function( field, filter ) {
            return fields[ field ].replace( filter, '' );
        };

        req.postman = {
            fields: fields,
            filter: filter,
            uint:   function( field ) { return filter(/[^0-9]/g); },
            int:    function( field ) { return filter(/[^-0-9]/g); }
        };

        callback( req, res );
    });
};

module.exports = postman;
