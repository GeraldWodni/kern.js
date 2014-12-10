// stock website
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

module.exports = {
    setup: function( k ) {

        k.router.get("/", function( req, res ) {
            k.httpStatus( req, res, 503 );
        });
    }
};
