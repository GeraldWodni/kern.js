$(function(){
    /* datepicker */
    $("input[rel='date']").datepicker({
        showWeek: true,
        changeYear: true,
        yearRange: '-100:+10',
        changeMonth: true,
        showButtonPanel: true
    });


    /* select validation */
    $('select[required]').change( function(){
        if( $(this).val() == 0 )
            this.setCustomValidity("Auswahl ungültig");
        else
            this.setCustomValidity("");
    }).trigger("change");
});
