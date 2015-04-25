// navigation administration module
// (c)copyright 2014 by Gerald Wodni <gerald.wodni@gmail.com>

var bcrypt      = require("bcrypt-nodejs");
var colors      = require("colors");
var util        = require("util");
var querystring = require("querystring");


module.exports = {
    setup: function( k ) {

        k.crud.presenter( k, k.users, {
            
            title: "Users",
            path: "/admin/users",
            unPrefix: true,

            fields: {
                id:         { name: "id", filter: "id", source: "requestman" },
                name:       { text: "Name",             type: "text", filter: "username", attributes: { required: true } },
                password:   { text: "Password",         type: "password" },
                password2:  { text: "Confirm password", type: "password", filter: "drop" },
                permissions:{ text: "Permissions",      type: "text", attributes: { required: true } }
            }

        });

        return;


    /* TODO: navigation: as simple as possible, just use LINK:FILE pairs, all LINKS open a jade file, which can in turn call views. If needed, you can also configure for special acion */
    /* TODO: keep track of all websites in redis */

        /* enable crud */
        k.rdb.crud.router( k, ["/", "/edit/:id"], k.rdb.users, {
            readFields: function ( req ) {
                var fields = {
                    name: req.postman.username("name"),
                    permissions: req.postman.linkList("permissions")
                };

                var password = req.postman.password();
                if( password && password.length > 0 )
                {
                    if( !req.postman.fieldsMatch( "password", "password2" ) )
                        throw req.locales.__( "Passwords do not match" );

                    if( password.length < k.rdb.users.minPasswordLength ) 
                        throw req.locales.__( "Password to short, minimum: {0}" ).format( k.rdb.users.minPasswordLength );

                    fields.password = password;
                }

                return fields;
            }
        });

        function renderAll( req, res, values ) {
            k.rdb.users.readAll( req.kern.website, function( err, items ) {
                if( err )
                    return next( err );

                items.forEach( function( item ) {
                    item.escapedLink = encodeURIComponent( item.link );
                });
            
                k.renderJade( req, res, "admin/users", k.reg("admin").values( req, { messages: req.messages, items: items, values: values } ) );
            });
        }

        k.router.get( "/edit/:link?", function( req, res ) {
            k.rdb.users.read(req.kern.website, req.requestData.escapedLink( 'link' ), function( err, data ) {
                if( err )
                    return next( err );

                renderAll( req, res, data );
            });
        });

        k.router.get( "/", function( req, res ) {
            renderAll( req, res );
        });
    }
};
