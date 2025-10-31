// Forgot password - send email and allow reset/login
// (c)copyright 2014-2015 by Gerald Wodni <gerald.wodni@gmail.com>
"use strict";

const crypto        = require("crypto");
var nodemailer      = require("nodemailer");
var smtpTransport   = require("nodemailer-smtp-transport");

const resetTimeout = 1800;
const randomLength = 16;

function p() {
    const args = [... arguments];
    const target = args.shift();
    return new Promise( (fulfill, reject) => {
        const callback = ( err, data ) => {
            if( err )
                reject(err);
            else
                fulfill( data );
        };
        args.push( callback );
        console.log( "P", target, args );
        target.apply( null, args );
    });
}

function getEmailKey( prefix, email ) {
    return prefix + ":password-reset-email:" + email;
}
function getHashKey( prefix, hash ) {
    return prefix + ":password-reset-hash:" + hash;
}

function getRandomHash() {
    return new Promise( (fulfill, reject) => crypto.randomBytes( randomLength, (err, buf) => {
        if( err )
            return reject( err );
        return fulfill( buf.toString('hex') );
    }) );
}

const userLoaders = [];

async function loadUser( website, email ) {
    if( userLoaders.length == 0 )
        throw new Error( "forgotPassword.registerLoadByName net set yet" );

    let lastException = null;
    let user = null;
    for( let { loadByName, link } of userLoaders )
        try {
            user = await p( loadByName, website, email );
            user.passwordResetLink = link;
            lastException = null;
        } catch( err ) {
            lastException = err;
        }

    if( lastException )
        throw lastException;

    return user;
}

module.exports = {
    setup: function( k ) {
        k.router.get("/reset/:hash", async (req, res, next) => {
            const hash = req.requestman.id("hash");
            const hashKey = getHashKey( req.kern.website, hash );

            try {
                const email = await p( k.rdb.get.bind( k.rdb ), hashKey );
                if( email == null )
                    throw k.err.locale( "Unknown hash. Use link from email. Only valid once" );
                const user = await loadUser( req.kern.website, email );

                req.sessionInterface.start( req, res, function() {
                    req.session.loggedInUsername = email;
                    req.user = user;

                    res.redirect( user.passwordResetLink );
                });
            } catch( err ) {
                req.messages.push( { type: "danger", title: req.locales.__("Error"), text: req.locales._err( err ) } );
                k.jade.render( req, res, "messages", { messages: req.messages });
            }
        });

        k.router.postman("/", async (req, res, next) => {
            const email = req.postman.email();
            try {
                const user = await loadUser( req.kern.website, email );

                /* reset link */
                const hash = await getRandomHash();
                const emailKey = getEmailKey( req.kern.website, email );
                const hashKey  = getHashKey(  req.kern.website, hash );

                const redisResultEmail = await p( k.rdb.set.bind( k.rdb ), [ emailKey, hash, "EX", resetTimeout, "NX" ] );
                if( redisResultEmail == null )
                    throw k.err.locale( "Password reset pending, please check your inbox" );

                const redisResultHash = await p( k.rdb.set.bind( k.rdb ), [ hashKey, email, "EX", resetTimeout, "NX" ] );
                if( redisResultHash == null )
                    throw k.err.locale( "Password reset failed" );

                const userRegistration = Object.assign( {},  req.kern.getWebsiteConfig( "userRegistration", {} ) );
                const mail = Object.assign({
                    link: `https://${req.kern.website}/forgot-password/reset/{hash}`,
                    from: userRegistration.smtp.email,
                    to: email,
                    bcc: userRegistration.smtp.email,
                    subject: `${req.kern.website} - password reset`,
                    text: `You have forgotten your ${req.kern.website} - password.\nPlease click on the following link to set a new password:\n{link}\n\nIn case you did not start the reset, please let us know.`
                }, userRegistration.forgotPasswordEmail );

                mail.link = mail.link.replace( /{hash}/g, hash );
                mail.text = mail.text.replace( /{link}/g, mail.link );

                console.log( "Passwort Reset:".bold.yellow, mail.to, mail.link );

                const emailTransport = nodemailer.createTransport( smtpTransport({
                    host: userRegistration.smtp.host,
                    port: userRegistration.smtp.port || 25,
                    tls: {
                        rejectUnauthorized: false
                    },
                    auth: {
                        user: userRegistration.smtp.user,
                        pass: userRegistration.smtp.password
                    }
                }) );

                await p( emailTransport.sendMail.bind( emailTransport ), mail );

                k.jade.render( req, res, "forgotPassword", {
                    success: req.locales.__( "Email sent, please use the link in provided via email to reset Password" ),
                });
            } catch( err ) {
                k.jade.render( req, res, "forgotPassword", {
                    email,
                    error: req.locales._err( err ),
                });
            }
        });

        k.router.get("/", (req, res) => {
            k.jade.render( req, res, "forgotPassword" );
        });
    },
    registerUserLoader( userLoader ) {
        userLoaders.push( userLoader );
    },
}
