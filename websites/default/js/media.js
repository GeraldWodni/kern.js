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
    var hasDragNDrop = function() {
        var div = document.createElement('div');
        return (('draggable' in div)
            || ('ondragstart' in div && 'ondrop' in div))
            && 'FormData' in window
            && 'FileReader' in window;
    }();

    var $fileUpload = $("form.file-upload");
    if( hasDragNDrop ) {
        $fileUpload.addClass("drag-n-drop");

        var $input = $fileUpload.find("input[type='file']");
        var $label = $fileUpload.find("label");

        var droppedFiles = false;

        $fileUpload.on("drag dragstart dragend dragover dragenter dragleave drop", function(e) {
            e.preventDefault();
            e.stopPropagation();
        })
        .on("dragover dragenter", function() {
            $fileUpload.addClass("is-dragover");
        })
        .on("dragleave dragend drop", function() {
            $fileUpload.removeClass("is-dragover");
        })
        .on("drop", function(e) {
            droppedFiles = e.originalEvent.dataTransfer.files;
            $fileUpload.trigger("submit");
        })
        .on("submit", function(e) {
            if( $fileUpload.hasClass("is-uploading")) return false;

            e.preventDefault();
            var ajaxData = new FormData($fileUpload.get(0));
            $fileUpload.addClass("is-uploading").removeClass("is-error");

            ajaxData.append( "ajax-upload", "true" );
            ajaxData.append( "upload-file", "true" );
            if( droppedFiles ) {
                $.each( droppedFiles, function( index, file ) {
                    console.log( "DROPPED:", file );
                    ajaxData.append( $input.attr("name"), file );
                });
            }

            $.ajax({
                url: window.location,
                type: "POST",
                data: ajaxData,
                dataType: 'json',
                cache: false,
                contentType: false,
                processData: false,
                complete: function() {
                    $fileUpload.removeClass( "is-uploading" );
                    droppedFiles = false;
                },
                success: function( data ) {
                    /* TODO: return HTML on success and prepend it to file-container */
                    $fileUpload.addClass( data.success == true ? 'is-success' : 'is-error' );
                    if( !data.success )
                        $fileUpload.find(".status.error span").text( data.error );
                },
                error: function( err ) {
                    console.error( "error uploading file:", err );
                }
            });
        });
        $input.on("click", function() {
            this.value = null;
        });
        $input.on("change", function(e) {
            console.log("CHANGE!");
            $fileUpload.trigger("submit");
        });

    }
});
