// Receive and handle post data
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var qs  = require( "qs" );
var _   = require("underscore");

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
            return (fields[ field ] || "").replace( filter, '' );
        };

        req.postman = _.extend( req.postman || {}, {
            fields: fields,
            exists:     function( field ) {
                            /* allow passing of single value or array */
                            if( ! _.isArray( field ) )
                                field = [ field ];
                            return _.every( field, function( f ) {
                                return f in fields;
                            });
                        },
            equals:     function( field, value ) {
                            return fields[ field ] == value;
                        },
            fieldsMatch:function( fieldA, fieldB ) {
                            return fields[ fieldA ] === fields[ fieldB ];
                        }
        } );

        /* register postman fetcher */
        req.postman = _.extend( req.postman, req.fetchFilter( function( field ) { 
            return fields[ field ] || "";
        }) );

        callback( req, res );
    });
};

module.exports = postman;
