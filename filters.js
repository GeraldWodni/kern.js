// Receive and handle post data
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var qs  = require( "qs" );
var _   = require("underscore");

function filters( req ) {

    function f( text, filter ) {
        if( text == null )
            return null;

        return text.replace( filter, "" );
    }

    /* registered filters */
    req.filters = {
        address:    function( t ) { return f( t, /[^-\/ a-zA-Z0-9äöüßÄÖÜ]/g     ); },
        allocnum:   function( t ) { return f( t, /[^a-zA-Z0-9äöüßÄÖÜ]/g         ); },
        alnum:      function( t ) { return f( t, /[^a-zA-Z0-9]/g                ); },
        alnumList:  function( t ) { return f( t, /[^,a-zA-Z0-9]/g               ); },
        dateTime:   function( t ) { return f( t, /[^-: 0-9]/g                   ); },
        decimal:    function( t ) { return f( t, /[^-.,0-9]/g                   ).replace(/,/g, '.'); },
        email:      function( t ) { return f( t, /[^-+_.0-9a-zA-Z]/g            ); },
        escapedLink:function( t ) { return f( decodeURIComponent( t ), /[^-_.a-zA-Z0-9\/]/g ); },
        filename:   function( t ) { return f( t, /[^-_.0-9a-zA-Z]/g             ); },
        id:         function( t ) { return f( t, /[^-_.:a-zA-Z0-9]/g            ); },
        int:        function( t ) { return f( t, /[^-0-9]/g                     ); },
        link:       function( t ) { return f( t, /[^-_a-zA-Z0-9\/]/g            ); },
        linkItem:   function( t ) { return f( t, /[^-_a-zA-Z0-9]/g              ); },
        linkList:   function( t ) { return f( t, /[^-,_a-zA-Z0-9]/g             ); },
        raw:        function( t ) { return t;                                      },
        singleLine: function( t ) { return f( t, /[^-_\/ a-zA-Z0-9äöüßÄÖÜ]/g    ); },
        telephone:  function( t ) { return f( t, /[^-+ 0-9]/g                   ); },
        text:       function( t ) { return t;                                      },
        uint:       function( t ) { return f( t, /[^0-9]/g                      ); },
        username:   function( t ) { return f( t, /[^@-_.a-zA-Z0-9]/g            ); }
    };

    /* return a new fetcher which supports all registered filters */
    req.fetchFilter = function( fetch ) {
        var filters = {};
        _.each( req.filters, function( filter, name ) {
            filters[ name ] = function( field ) {
                return filter( fetch( field ) );
            }
        });
        return filters;
    };
};

module.exports = filters;
