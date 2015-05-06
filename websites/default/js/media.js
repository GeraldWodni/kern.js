$(function(){
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
                console.log( "Create:", prefix, name );
                $modal.modal("hide");
            });
        });
    });
});
