/* media-file-tree ajax */
/* (c)copyright 2015 by Gerald Wodni <gerald.wodni@gmail.com> */

$(function(){
    /* TODO:
        - close modal after upload
        - show new files
        - bind new files and directories
        - create thumbnails
        - fix static links
    */
    /* create new folder */
    $("button[data-action='new-folder']").click(function(){
        var $li = $(this).closest("li");
        var $modal = $("#newFolderModal");
        $modal.modal("show");
        $modal.find(".btn-primary").unbind().click(function(){
            var prefix = $li.attr("data-prefix");
                prefix+= "/" + $li.attr("data-dirname");
            var name = $modal.find("input[name='name']").val();

            $.post( "/admin/media/new-folder", { prefix: prefix, name: name }, function(data, status) {
                if( data.success ) {
                    $li.children("ul:eq(0)").prepend( $("#directoryTemplate").loadTemplate( { prefix: prefix, name: name } ) );
                }
                else
                    alert( "Error", data );

                $modal.modal("hide");
            });
        });
    });

    /* delete folder */
    $("button[data-action='delete-folder']").deleteButton(function(){
        var $li = $(this).closest("li");
        var prefix = $li.attr("data-prefix");
        var name = $li.attr("data-dirname");

        $.post( "/admin/media/delete-folder", { prefix: prefix, name: name }, function(data, status) {
            if( data.success ) {
                $li.remove();
            }
        });
    });

    $("button[data-action='delete-file']").deleteButton(function() {
        var $li = $(this).closest("li");
        var link = $li.children("a:eq(0)").attr("href");

        $.post( "/admin/media/delete-file", { link: link }, function(data, status) {
            if( data.success ) {
                $li.remove();
            }
        });
    });

    /* upload */
    var $file = $("#uploadModal input[name='file']");
    var uploadDirectory = "";
    $file.fileinput({
        showUpload: false,
        showRemove: false,
        uploadUrl: "/admin/media/upload/"
    });
    $("button[data-action='upload']").click(function(){
        /* update upload directory */
        var $li = $(this).closest("li");
        $file.fileinput("clear");
        uploadDirectory = $li.attr("data-prefix") + "/" + $li.attr("data-dirname");
        $file.fileinput("refresh", { uploadUrl: "/admin/media/upload" + uploadDirectory });

        /* execute upload */
        $("#uploadModal .modal-footer .btn-primary").unbind().click(function(){
            $file.fileinput("upload");
        });
        $("#uploadModal").modal("show");
    });

    //$("ul.filetree > li.directory:last()").after( $("#directoryTemplate").loadTemplate({ name: "hallo name ;)" }) );
});
