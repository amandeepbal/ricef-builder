sap.ui.define(["sap/ui/core/mvc/Controller"], function (Controller) {
    "use strict";
    return Controller.extend("com.syntax.ricefbuilder.controller.admin.AdminMain", {
        onNav: function (oEvent) {
            var tile = oEvent.getSource();
            var key = tile.data("key");
            if (key) this.getOwnerComponent().getRouter().navTo(key);
        },
        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("home");
        }
    });
});
