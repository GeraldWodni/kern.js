// handle request data
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

function requestData( req ) {
    var filter = function( field, filter ) {
        var value = req.params[ field ];

        if( value == null )
            return null;

        return value.replace( filter, '' );
    };

    req.requestData = {
        filter: filter,
        int:        function( field ) { return filter( field, /[^-0-9]/g            ); },
        filename:   function( field ) { return filter( field, /[^-_.0-9a-zA-Z]/g    ); }
    }
}

module.exports = requestData;
