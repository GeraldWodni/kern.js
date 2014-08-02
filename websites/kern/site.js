// kern.js' setup functions
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var bcrypt  = require("bcrypt-nodejs");

module.exports = {
    setup: function( k ) {

        /* show basic hello if nothing else catched up until here */
        k.router.get("/kern-setup", function( req, res ) {
            k.renderJade( req, res, "setup", { messages: [] }, { website: "kern" } );
        });
        
        k.router.post("/kern-setup", function( req, res ) {
            k.modules.postman( req, res, function( req, res ) {
                messages = [];
                success = true;
        
                console.log( req.postman.fields );
        
                /* validate */
                if( !req.postman.equals( "token", k.serverConfig.authToken ) ) {
                    messages.push( { type: "danger", text: "AuthToken not correct" } );
                    success = false;
                }
        
                if( !req.postman.fieldsMatch( "password", "password2" ) ) {
                    messages.push( { type: "danger", text: "Passwords do not match" } );
                    success = false;
                }
        
                /* abort here on user-error */
                if( !success ) {
                    k.renderJade( req, res, "setup", { messages: messages }, { website: "kern" } );
                    return;
                }
        
                var username = req.postman.username( "username" );
                var passhash = bcrypt.hashSync( req.postman.fields.password );
                
                k.rdb.hset( "kern.server.admins", username, passhash, function( err ) {
                    if( err ) {
                        messages.push( { type: "danger", title: "Redis-Error", text: err } );
                        k.renderJade( req, res, "setup", { messages: messages }, { website: "kern" } );
                    }
                    else
                        k.renderJade( req, res, "setupDone", {}, { website: "kern" } );
                
                });
        
            });
        });
    }
};
