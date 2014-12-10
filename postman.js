// Receive and handle post data
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var qs  = require( "qs" );
var _   = require("underscore");

function postman( req, res, callback ) {
    var body = '';

    function filterText( text, filter ) {
        return text.replace( filter, "" );
    }

    req.filters = {
        uint:       function( text ) { return filterText( text, /[^0-9]/g               ); },
        int:        function( text ) { return filterText( text, /[^-0-9]/g              ); },
        decimal:    function( text ) { return filterText( text, /[^-.,0-9]/g            ).replace(/,/g, '.'); },
        id:         function( text ) { return filterText( text, /[^-_.:a-zA-Z0-9]/g     ); },
        alnum:      function( text ) { return filterText( text, /[^a-zA-Z0-9]/g         ); },
        alnumList:  function( text ) { return filterText( text, /[^,a-zA-Z0-9]/g        ); },
        link:       function( text ) { return filterText( text, /[^-_a-zA-Z0-9\/]/g     ); },
        linkItem:   function( text ) { return filterText( text, /[^-_a-zA-Z0-9]/g       ); },
        username:   function( text ) { return filterText( text, /[^@-_.a-zA-Z0-9]/g     ); }
    };

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
            filter: filter,
            uint:       function( field ) { return filter( field, /[^0-9]/g             ); },
            int:        function( field ) { return filter( field, /[^-0-9]/g            ); },
            decimal:    function( field ) { return filter( field, /[^-.,0-9]/g          ).replace(/,/g, '.'); },
            id:         function( field ) { return filter( field || "id", /[^-_.:a-zA-Z0-9]/g   ); },
            alnum:      function( field ) { return filter( field, /[^a-zA-Z0-9]/g   ); },
            allocnum:   function( field ) { return filter( field, /[^a-zA-Z0-9äöüßÄÖÜ]/g ); },
            address:    function( field ) { return filter( field || "address", /[^-\/ a-zA-Z0-9äöüßÄÖÜ]/g ); },
            linkList:   function( field ) { return filter( field, /[^-,a-zA-Z0-9]/g   ); },
            link:       function( field ) { return filter( field || "link", /[^-_a-zA-Z0-9\/]/g   ); },
            username:   function( field ) { return filter( field || "username", /[^@-_.a-zA-Z0-9]/g   ); },
            password:   function( field ) { return fields[ field || "password" ];                        },
            telephone:  function( field ) { return filter( field || "telephone", /[^-+ 0-9]/g ); },
            email:      function( field ) { return filter( field || "email", /[^-+_.0-9a-zA-Z]/g ); },
            dateTime:   function( field ) { return filter( field, /[^-: 0-9]/g ); },
            text:       function( field ) { fields[ field ]; },
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

        callback( req, res );
    });
};

module.exports = postman;
