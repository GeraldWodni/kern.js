// administration utility
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var bcrypt  = require("bcrypt-nodejs");

module.exports = {
    setup: function( k ) {

        k.router.get( "/", function( req, res ) {
            k.renderJade( res, req.kern.website, "admin/info", {} );
        });

    }
};
