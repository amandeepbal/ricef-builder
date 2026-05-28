sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.Launchpad", {
        onTilePress: function (oEvent) {
            var target = oEvent.getSource().data("target");
            this.getOwnerComponent().getRouter().navTo(target);
        }
    });
});
