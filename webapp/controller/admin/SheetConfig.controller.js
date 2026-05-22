sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "../../model/helpDialog"
], function (Controller, JSONModel, MessageToast, helpDialog) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.admin.SheetConfig", {
        _sheetCode: "RICEF",

        onInit: function () {
            this.getView().setModel(new JSONModel([]), "cols");
            this.getOwnerComponent().getRouter().getRoute("adminSheetConfig")
                .attachPatternMatched(this._load, this);
        },

        _load: function () {
            this._loadColumns();
        },

        _getVersionId: function () {
            var m = this.getOwnerComponent().getModel("adminCtx");
            return (m && m.getProperty("/versionId")) || 1;
        },

        _loadColumns: function () {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/admin/sheet-types/" + this._sheetCode + "/columns?version_id=" + this._getVersionId()
            ).then(function (data) {
                that.getView().getModel("cols").setData(data);
            });
        },

        onSheetChange: function (oEvent) {
            this._sheetCode = oEvent.getParameter("selectedItem").getKey();
            this._loadColumns();
        },

        onSave: function () {
            var that = this;
            var cols = this.getView().getModel("cols").getData().map(function (c) {
                return {
                    column_key: c.column_key,
                    column_label: c.column_label,
                    is_visible: c.is_visible ? 1 : 0,
                    is_editable: c.is_editable ? 1 : 0,
                    sort_order: parseInt(c.sort_order) || 0,
                    width: c.width
                };
            });
            this.getOwnerComponent().api("PUT",
                "/admin/sheet-types/" + this._sheetCode + "/columns",
                { columns: cols }
            ).then(function () {
                MessageToast.show("Saved");
                that._loadColumns();
            });
        },

        onHelp: function () {
            helpDialog.show("adminSheetConfig");
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("admin");
        }
    });
});
