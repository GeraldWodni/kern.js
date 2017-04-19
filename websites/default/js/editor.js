/* Edit a real file on the webserver */
/* (c)copyright 2017 by Gerald Wodni<gerald.wodni@gmail.com> */
$(document).ready(function(){
    var $sourceTextarea = $('#editor-textarea');
    var height = $(window).height() - 200;
    $sourceTextarea.after('<div id="editor" class="form-control" style="height:' + height + 'px"> </div>').hide();
    $sourceTextarea.siblings("label").hide();

    var modes = [ "jade", "js", "json", "less" ];
    var mode = $sourceTextarea.attr("data-type");

    var editor = ace.edit("editor");
    if( modes.indexOf( mode ) >= 0 )
        editor.getSession().setMode("ace/mode/" + mode);
    editor.getSession().setTabSize(4);
    editor.getSession().setUseSoftTabs(true);
    editor.setTheme("ace/theme/github");

    editor.getSession().setValue($sourceTextarea.val());
    editor.getSession().on("change", function() {
        $sourceTextarea.val( editor.getSession().getValue() );
    });

});
