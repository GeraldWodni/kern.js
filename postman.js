// Receive and handle post data
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

const Busboy    = require("busboy");
const qs        = require("qs");
const _         = require("underscore");

module.exports = function _postman( k ) {
    return function postman( req, res, opts, callback ) {
        /*  if no opts are passed, treat as callback */
        if( _.isFunction( opts ) && typeof callback == "undefined" ) {
            callback = opts;
            opts = {};
        }

        const contentType = req.get( "Content-Type" );

        function addPostman( fields ) {
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
            req.postman = _.extend( req.postman, k.filters.fetch( function( field ) {
                return fields[ field ] || "";
            }) );
        }

        if( typeof contentType !== "undefined" && contentType.toLowerCase().indexOf( "multipart/form-data" ) == 0 ) {
            let fields = {};
            /* connect handlers */
            var busboy = new Busboy( _.extend( { headers: req.headers }, opts.busboy ) );
            if( !_.has( opts, "onFile" ) )
                throw new Error( "multipart/form-data not expected: No file handler installed" );

            busboy.on( "file", opts.onFile );
            busboy.on( "field", ( name, value ) => {
                fields[ name ] = value;
            });
            busboy.on( "finish", () => {
                addPostman( fields );
                callback( req, res );
            });
            busboy.on( "error", (err) => {
                console.log( "Postman-Busboy-Error".bold.red, err );
            });
            req.pipe( busboy );
        }
        else {
            let body = '';
            /* handle simple upload */
            req.on( 'data', function( data ) {
                body += data;

                /* beware of multipart filesize */
                if( body.length > 2e6 ) {
                    req.connection.destroy();
                    console.log( "Postman-body-too-big".bold.red );
                }
            });

            req.on( "end", function() {
                switch( contentType ) {
                    case 'application/json':
                        req.body = JSON.parse( body );
                        break;
                    case 'text/plain':
                        req.body = body;
                        break;
                    /* assume post-data */
                    default:
                        addPostman( qs.parse( body, { parseArrays: false } ) );
                }

                callback( req, res );
            });
        }
    };
};
