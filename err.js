// error reporting
// (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com>

module.exports = function _err( k ) {

    function renderHttpStatus( req, res, code , opts ) {
        if( !_.has( httpStati, code ) )
            code = 501;

        res.status( code );
        k.jade.render( req, res, "httpStatus", _.extend( { code: code }, httpStati[ code ] ) );
    }


    function route() {
        k.app.use(function(err, req, res, next) {
            res.status(err.status || 500);
            console.log( "ERROR HANDLER!".red.bold, err.message, "\n", err.stack );
            console.trace();
            k.jade.render( req, res, "error", {
                message: err.message,
                error: err
            });
        });

        /* catch all / show 404 */
        k.app.use(function( err, req, res, next ) {
            console.log( "ERROR HANDLER2".red.bold, err );
            if( err.status !== 404 )
                return next();
                
            if( req.config )
                k.jade.render( req, res, "websites/kern/views/layout.jade" );
            else
                k.jade.render( req, res, "no-config", {}, { website: "kern" } );
        });

        k.app.use(function( err, req, res, next ) {
            res.status("500").send("Strange ERROR:" +err.toString() );
        });

        k.app.use(function( req, res, next ) {
            res.status("404").send("Strange 404 - EOK");
        });
    }

    function routeLog( router ) {
        var args = [];
        Array.prototype.push.apply( args, arguments );
        args.shift();

        router.use( function( req, res, next ) {
            console.log.apply( console, args );
            next();
        });
    }

    return {
        renderHttpStatus: renderHttpStatus,
        routeLog: routeLog,
        route: route
    }
};
