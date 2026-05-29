sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "../model/guideDialog"
], function (Controller, JSONModel, Fragment, guideDialog) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.App", {
        onInit: function () {
            var oUserModel = new JSONModel({
                id: "",
                name: "",
                email: "",
                initials: "",
                isAdmin: true,
                isUser: true,
                appVersion: "1.0.0",
                environment: "Local",
                theme: sap.ui.getCore().getConfiguration().getTheme()
            });
            this.getOwnerComponent().setModel(oUserModel, "userInfo");
            this._loadUserInfo();

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.attachRouteMatched(this._onRouteMatched, this);
        },

        _loadUserInfo: function () {
            var oModel = this.getOwnerComponent().getModel("userInfo");
            this.getOwnerComponent().api("GET", "/user-info").then(function (data) {
                oModel.setProperty("/id", data.id || "local");
                oModel.setProperty("/name", data.name || "Local User");
                oModel.setProperty("/email", data.email || "");
                oModel.setProperty("/isAdmin", data.isAdmin !== false);
                oModel.setProperty("/isUser", data.isUser !== false);
                oModel.setProperty("/environment", data.environment || "Local");

                var name = data.name || data.id || "";
                var parts = name.split(/[\s.@]+/);
                var initials = parts.length >= 2
                    ? (parts[0][0] + parts[1][0]).toUpperCase()
                    : name.substring(0, 2).toUpperCase();
                oModel.setProperty("/initials", initials);
            }).catch(function () {
                oModel.setProperty("/initials", "LU");
            });
        },

        _onRouteMatched: function (oEvent) {
            var sRoute = oEvent.getParameter("name");
            var oAppView = this.getOwnerComponent().getModel("appView");
            oAppView.setProperty("/showNavButton", sRoute !== "launchpad");
        },

        onShellHome: function () {
            this.getOwnerComponent().getRouter().navTo("launchpad");
        },

        onUserInfo: function (oEvent) {
            var oSource = oEvent.getSource();
            if (!this._pUserPopover) {
                this._pUserPopover = Fragment.load({
                    id: this.getView().getId(),
                    name: "com.syntax.ricefbuilder.fragment.UserInfoPopover",
                    controller: this
                }).then(function (oPopover) {
                    this.getView().addDependent(oPopover);
                    return oPopover;
                }.bind(this));
            }
            this._pUserPopover.then(function (oPopover) {
                oPopover.openBy(oSource);
            });
        },

        onCloseUserInfo: function () {
            this.byId("userInfoPopover").close();
        },

        onThemeChange: function (oEvent) {
            var sTheme = oEvent.getParameter("item").getKey();
            sap.ui.getCore().applyTheme(sTheme);
            this.getOwnerComponent().getModel("userInfo").setProperty("/theme", sTheme);
        },

        onGuide: function () {
            guideDialog.show();
        }
    });
});
