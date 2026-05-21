sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.App", {
        onToggleSideNav: function () {
            var tp = this.byId("toolPage");
            tp.setSideExpanded(!tp.getSideExpanded());
        },
        onNavHome: function () {
            this.getOwnerComponent().getRouter().navTo("home");
        },
        onNavToAdmin: function () {
            this.getOwnerComponent().getRouter().navTo("admin");
        },
        onNavAdmin: function (oEvent) {
            var key = oEvent.getParameter("item").getKey();
            this.getOwnerComponent().getRouter().navTo(key);
        }
    });
});
