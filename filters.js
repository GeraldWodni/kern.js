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
    const localChars = "¢£ªºÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþŸÿĀāĐđĒēĲĳĿŀŒœŠšŽžſ€";
    function regC( regex, modifiers ) { return new RegExp( regex.replace( /LC/g, localChars ), modifiers + "u" ); }
    var registeredFilters = {
        address:    function( t ) { return f( t, regC("[^-,.\/ a-zA-Z0-9LC]","g"));},
        allocnum:   function( t ) { return f( t, regC("[^a-zA-Z0-9LC]", "g")    ); },
        alpha:      function( t ) { return f( t, /[^a-zA-Z]/g                   ); },
        alnum:      function( t ) { return f( t, /[^a-zA-Z0-9]/g                ); },
        alnumList:  function( t ) { return f( t, /[^,a-zA-Z0-9]/g               ); },
        boolean:    function( t ) { return f( t, /[^01]/g                       ); },
        color:      function( t ) { return f( t, /[^#a-fA-F0-9]/g               ); },
        dateTime:   function( t ) { return f( t, /[^-\/_.: 0-9]/g               ).replace(/_/g, ' '); },
        decimal:    function( t ) { return f( t, /[^-.,0-9]/g                   ).replace(/,/g, '.'); },
        email:      function( t ) { return f( t, /[^-@+_.0-9a-zA-Z]/g            ); },
        emails:     function( t ) { return f( t, /[^-,@+_.0-9a-zA-Z]/g           ); },
        escapedLink:function( t ) { return f( decodeURIComponent( t ), /[^-_.a-zA-Z0-9\/]/g ); },
        filename:   function( t ) { return f( t, /[^-_.0-9a-zA-Z]/g             ); },
        filepath:   function( t ) { return f( t, /[^-\/_.0-9a-zA-Z]/g           ); },
        filepathLax:function( t ) { return f( t, /[^- \/_.0-9a-zA-Z]/g          ); },
        hex:        function( t ) { return f( t, /[^-0-9a-f]/g                  ); },
        id:         function( t ) { return f( t, /[^-_.:a-zA-Z0-9]/g            ); },
        int:        function( t ) { return f( t, /[^-0-9]/g                     ); },
        isset:      function( t ) { return typeof t !== "undefined";               },
        link:       function( t ) { return f( t, /[^-_.:a-zA-Z0-9\/]/g          ); },
        linkItem:   function( t ) { return f( t, /[^-_.:a-zA-Z0-9]/g            ); },
        linkList:   function( t ) { return f( t, /[^-,_.:a-zA-Z0-9]/g           ); },
        password:   function( t ) { return t;                                      },
        raw:        function( t ) { return t;                                      },
        singleLine: function( t ) { return f( t, regC("[^-_\/ a-zA-Z0-9LC]", "g"));},
        telephone:  function( t ) { return f( t, /[^-+ 0-9]/g                   ); },
        text:       function( t ) { return t;                                      },
        uint:       function( t ) { return f( t, /[^0-9]/g                      ); },
        url:        function( t ) { return f( t, /[^-?#@&,+_.:\/a-zA-Z0-9]/g    ); },
        username:   function( t ) { return f( t, /[^-@_.a-zA-Z0-9]/g            ); },
        renameFile: function( t ) {
            return t
                .replace( /ä/g, "ae" ).replace( /ö/g, "oe" ).replace( /ü/g, "ue" ).replace( "ß", "sz" )
                .replace( /Ä/g, "Ae" ).replace( /Ö/g, "Oe" ).replace( /Ü/g, "Ue" )
                .replace( regC( "[LC]", "g" ), "" )
                .replace( /\s+/g, "_" ).replace( /[^-_.0-9a-zA-Z]/g, "" );
        },
        json: function( t ) {
            try {
                JSON.parse( t );
                return t;
            } catch( err ) {
                return null;
            }
        },
    };

    /* return a new fetcher which supports all registered filters */
    registeredFilters.fetch = function _filters_fetch( fetch ) {
        var filters = {
            /* walk array through filter */
            array: function( filter, field ) {
                if( typeof field === "undefined" )
                    field = filter;

                const data = filters.object( filter, field, "uint" );
                const values = [];

                for( let i = 0; i < Object.keys( data ).length; i++ )
                    if( data.hasOwnProperty( i ) )
                        values.push( registeredFilters[ filter ]( data[i] ) );
                    else
                        throw new Error( "filter.array expects all field-keys to be numeric and a contonious range from [0..n)" );

                return values;
            },
            object: function( filter, field, keyFilter = "id" ) {
                if( typeof field === "undefined" )
                    field = filter;

                let data = fetch( field );
                if( typeof data != "object" )
                    if( typeof data === "undefined" || data === "" )
                        return {};
                    else
                        throw new Error( `filter.object expectes field(${field}) to fetch as object` );

                if( data == null )
                    data = {};

                const obj = {}
                for( let [key, value] of Object.entries( data ) ) {
                    key = registeredFilters[ keyFilter ]( key );
                    obj[ key ] = registeredFilters[ filter ]( value );
                }

                return obj;
            },
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
