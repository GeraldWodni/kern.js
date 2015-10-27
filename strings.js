// String prototype extenders
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

if( !String.prototype.format ) {
    String.prototype.format = function() {
        var args = arguments;
        return this.replace( /{([0-9]+)}/g, function( match, index ) {

            /* agrument passed? */
            if( typeof args[ index ] === 'undefined' )
                return match;

            return args[ index ];
        });
    };
}
