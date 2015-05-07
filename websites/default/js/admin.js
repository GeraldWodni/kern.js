$(function(){
    /* datepicker */
    $("input[rel='date']").datepicker({
        showWeek: true,
        changeYear: true,
        yearRange: "-100:+10",
        changeMonth: true,
        showButtonPanel: true
    });


    /* select validation */
    $("select[required]").change( function(){
        if( $(this).val() == 0 )
            this.setCustomValidity("Auswahl ungültig");
        else
            this.setCustomValidity("");
    }).trigger("change");
});

/* template helper */
(function( $ ) {
    $.fn.loadTemplate = function( values ) {
        var template = this.html();

        template = template.replace( /{([a-zA-Z0-9.+]+)}/g, function( match, name ) {
            if( name in values )
                return values[ name ];
            else
                return "";
        });

        return $(template);
    };
    $.fn.deleteButton = function( callback ) {

        this.each( function() {
            var button = this;
            var $button = $(button);

            $button.click( function() {
                /* only execute in danger-mode */
                if( $button.hasClass("btn-danger" ) ) {
                    callback.apply( button, [] );
                }
                /* mode management */
                else if( $button.hasClass("btn-default") ) {
                    $button.removeClass("btn-default").addClass("btn-primary");
                    /* set primary and after 1s delay to danger */
                    setTimeout( function() {
                        $button.removeClass("btn-primary").addClass("btn-danger");
                    }, 1000 );
                    /* reset to default */
                    setTimeout( function() {
                        $button.removeClass("btn-danger").addClass("btn-default");
                    }, 5000 );
                }
            });
        });
        
        return this;
    };
}( jQuery ));
