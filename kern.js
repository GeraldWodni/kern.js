var http = require("http");
var debug = require("debug")("kern");
var _ = require("underscore");

/* default value for kern instances */
var defaults = {
    port: 3000
};

/* main export */
var Kern = function( opts ) {
    
    opts = _.extend( defaults, opts );

    return {
        run: function() {
            debug( "Listening on Port " + opts.port );

            http.createServer( function( req, res ) {
                res.writeHead( 200, { 'Content-Type': 'text/plain' } );
                res.end( "Hello, here is kern.js" );
            }).listen( opts.port );
        }
    };
};

module.exports = Kern;

