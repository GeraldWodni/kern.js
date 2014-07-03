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
            uint:       function( field ) { return filter( field, /[^0-9]/g             ); },
            int:        function( field ) { return filter( field, /[^-0-9]/g            ); },
            decimal:    function( field ) { return filter( field, /[^-.,0-9]/g          ).replace(/,/g, '.'); },
            id:         function( field ) { return filter( field, /[^-_.:a-zA-Z0-9]/g   ); },
            username:   function( field ) { return filter( field, /[^@-_.a-zA-Z0-9]/g   ); },
            equals:     function( field, value ) {
                            return fields[ field ] == value;
                        },
            fieldsMatch:function( fieldA, fieldB ) {
                            return fields[ fieldA ] === fields[ fieldB ];
                        }
        };

        callback( req, res );
    });
};

module.exports = postman;
