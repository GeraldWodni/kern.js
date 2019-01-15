$(function(){
    /* datepicker */
    $("input[rel='date']").datepicker({
        showWeek: true,
        changeYear: true,
        yearRange: "-100:+10",
        changeMonth: true,
        showButtonPanel: true
    }).attr("autocomplete", "nope");
    /* set to random string, see: https://stackoverflow.com/questions/12374442/chrome-ignores-autocomplete-off/38961567#38961567 */


    /* select validation */
    $("select[required]").change( function(){
        if( $(this).val() == 0 )
            this.setCustomValidity("Auswahl ungültig");
        else
            this.setCustomValidity("");
    }).trigger("change");

    /* permissions */
    /* missing: info, b1300-admin-all, roof-services-all */
    $("input[data-csv-multi]").each(function() {
        var $this = $(this);
        var prefix = $this.attr("name") + "-csv-multi-";
        var items = $this.attr("data-csv-multi");// + "," + $this.val();
        var selected = $this.val().split(",");
        items.split( "," ).sort().reverse().forEach( function( item ) {
            if( item.trim().length == 0 )
                return;
            $(`<div class="checkbox">
                <label><input type="checkbox" data-item="${item}" name="${prefix}${item}" ${selected.indexOf(item) >= 0 ? 'checked="checked"' : ''}/>
                    ${item}
                </label>
            </div>`).insertAfter( $this.closest(".form-group") ).change(function() {
                var current = [];
                $(`input[type=checkbox][name^='${prefix}']`).each(function() {
                    if( $(this).prop("checked") )
                        current.push( $(this).attr("data-item") );
                });
                $this.val( current.join(",") );
            });
        });
    });
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
