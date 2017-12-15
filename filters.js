// Receive and handle post data
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

var qs  = require( "qs" );
var _   = require("underscore");


module.exports = function _filters( k ) {

    function f( text, filter ) {
        if( text == null )
            return null;

        return text.replace( filter, "" );
    }

    /* registered filters */
    var registeredFilters = {
        address:    function( t ) { return f( t, /[^-,.\/ a-zA-Z0-9äöüßÄÖÜ]/g   ); },
        allocnum:   function( t ) { return f( t, /[^a-zA-Z0-9äöüßÄÖÜ]/g         ); },
        alpha:      function( t ) { return f( t, /[^a-zA-Z]/g                   ); },
        alnum:      function( t ) { return f( t, /[^a-zA-Z0-9]/g                ); },
        alnumList:  function( t ) { return f( t, /[^,a-zA-Z0-9]/g               ); },
        boolean:    function( t ) { return f( t, /[^01]/g                       ); },
        color:      function( t ) { return f( t, /[^#a-fA-F0-9]/g               ); },
        dateTime:   function( t ) { return f( t, /[^-: 0-9]/g                   ); },
        decimal:    function( t ) { return f( t, /[^-.,0-9]/g                   ).replace(/,/g, '.'); },
        email:      function( t ) { return f( t, /[^-@+_.0-9a-zA-Z]/g            ); },
        escapedLink:function( t ) { return f( decodeURIComponent( t ), /[^-_.a-zA-Z0-9\/]/g ); },
        filename:   function( t ) { return f( t, /[^-_.0-9a-zA-Z]/g             ); },
        filepath:   function( t ) { return f( t, /[^\/-_.0-9a-zA-Z]/g           ); },
        hex:        function( t ) { return f( t, /[^-0-9a-f]/g                  ); },
        id:         function( t ) { return f( t, /[^-_.:a-zA-Z0-9]/g            ); },
        int:        function( t ) { return f( t, /[^-0-9]/g                     ); },
        link:       function( t ) { return f( t, /[^-_.a-zA-Z0-9\/]/g            ); },
        linkItem:   function( t ) { return f( t, /[^-_.a-zA-Z0-9]/g              ); },
        linkList:   function( t ) { return f( t, /[^-,_.a-zA-Z0-9]/g             ); },
        password:   function( t ) { return t;                                      },
        raw:        function( t ) { return t;                                      },
        singleLine: function( t ) { return f( t, /[^-_\/ a-zA-Z0-9äöüßÄÖÜ]/g    ); },
        telephone:  function( t ) { return f( t, /[^-+ 0-9]/g                   ); },
        text:       function( t ) { return t;                                      },
        uint:       function( t ) { return f( t, /[^0-9]/g                      ); },
        url:        function( t ) { return f( t, /[^-?#@&,+_.:\/a-zA-Z0-9]/g    ); },
        username:   function( t ) { return f( t, /[^-@_.a-zA-Z0-9]/g            ); },
        renameFile: function( t ) {
            return t
                .replace( /ä/g, "ae" ).replace( /ö/g, "oe" ).replace( /ü/g, "ue" ).replace( "ß", "sz" )
                .replace( /Ä/g, "Ae" ).replace( /Ö/g, "Oe" ).replace( /Ü/g, "Ue" )
                .replace( /\s+/, "_" ).replace( /[^-_.0-9a-zA-Z]/g, "" );
        }
    };

    /* return a new fetcher which supports all registered filters */
    registeredFilters.fetch = function _filters_fetch( fetch ) {
        var filters = {
            /* walk array through filter */
            array: function( filter, field ) {
                var values = [];
                if( typeof field === "undefined" )
                    field = filter;

                var data = fetch( field );
                if( !Array.isArray( data ) )
                    if( typeof data === "undefined" || data === "" )
                        data = [];          // no value generates empty array
                    else
                        data = [ data ];    // convert single value to array

                data.forEach( function( item ) {
                    values.push( registeredFilters[ filter ]( item ) );
                });

                return values;
            }
        };
        _.each( registeredFilters, function _filters_fetch_callback( filter, name ) {
            filters[ name ] = function( field ) {
                if( typeof field === "undefined" )
                    field = name;
                return filter( fetch( field ) );
            }
        });
        return filters;
    };

    return registeredFilters;
};
