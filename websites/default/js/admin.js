$(function(){
    $("input[rel='date']").datepicker({
        showWeek: true,
        changeYear: true,
        yearRange: '-100:+10',
        changeMonth: true,
        showButtonPanel: true
    });
});
