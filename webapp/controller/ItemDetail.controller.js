sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Item",
    "sap/ui/core/SeparatorItem",
    "sap/m/MessageToast",
    "../model/formatter"
], function (Controller, JSONModel, Item, SeparatorItem, MessageToast, formatter) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.ItemDetail", {
        formatter: formatter,
        _projectId: null,
        _itemId: null,
        _saveTimer: null,

        onInit: function () {
            this.getView().setModel(new JSONModel({}), "item");
            this.getOwnerComponent().getRouter().getRoute("itemDetail")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var args = oEvent.getParameter("arguments");
            this._projectId = args.projectId;
            this._itemId = args.itemId;
            this._loadItem().then(this._loadDropdowns.bind(this));
        },

        _loadItem: function () {
            var that = this;
            return this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/items/" + this._itemId
            ).then(function (data) {
                that.getView().getModel("item").setData(data);
            });
        },

        _loadDropdowns: function () {
            var that = this;
            var item = this.getView().getModel("item").getData();
            var sheetType = item.sheet_type_code || "RICEF";

            var classCode = sheetType === "BI" ? "CLASSIFICATION_BI" :
                            sheetType === "MIGRATION" ? "CLASSIFICATION_MIG" :
                            "CLASSIFICATION_DEV";

            var techRoleCode = sheetType === "BI" ? "TECH_ROLE_BI" :
                               sheetType === "MIGRATION" ? "TECH_ROLE_MIG" :
                               "TECH_ROLE_DEV";

            var loads = [
                { code: "STATUS",      selectIds: ["statusSelect"] },
                { code: "COMPLEXITY",  selectIds: ["complexitySelect"] },
                { code: "RESPONSIBLE", selectIds: ["funcTeamSelect", "techTeamSelect"] },
                { code: "FUNC_ROLE",   selectIds: ["funcRoleSelect"] },
                { code: classCode,     selectIds: ["classificationSelect"] },
                { code: techRoleCode,  selectIds: ["techRoleSelect"] }
            ];

            loads.forEach(function (entry) {
                that.getOwnerComponent().api("GET", "/admin/dropdowns/" + entry.code)
                    .then(function (cat) {
                        entry.selectIds.forEach(function (selectId) {
                            that._populateSelect(selectId, cat.values);
                        });
                    });
            });
        },

        _populateSelect: function (selectId, values) {
            var select = this.byId(selectId);
            if (!select) return;

            select.removeAllItems();
            select.addItem(new Item({ key: "", text: "" }));

            values.forEach(function (v) {
                if (!v.is_active) return;
                if (v.is_separator) {
                    var label = v.value.replace(/^-+\s*/, "").replace(/\s*-+$/, "");
                    select.addItem(new SeparatorItem({ text: label }));
                } else {
                    select.addItem(new Item({ key: v.value, text: v.value }));
                }
            });
        },

        onFieldChange: function () {
            var that = this;
            if (this._saveTimer) clearTimeout(this._saveTimer);
            this._saveTimer = setTimeout(function () {
                that._autoSave();
            }, 400);
        },

        _autoSave: function () {
            var that = this;
            var data = this.getView().getModel("item").getData();
            this.getOwnerComponent().api("PUT",
                "/projects/" + this._projectId + "/items/" + this._itemId, data
            ).then(function (updated) {
                that.getView().getModel("item").setData(updated);
            });
        },

        onSave: function () {
            var that = this;
            var data = this.getView().getModel("item").getData();
            this.getOwnerComponent().api("PUT",
                "/projects/" + this._projectId + "/items/" + this._itemId, data
            ).then(function (updated) {
                that.getView().getModel("item").setData(updated);
                MessageToast.show("Saved");
            });
        },

        onRecalculate: function () {
            var that = this;
            this.getOwnerComponent().api("POST",
                "/projects/" + this._projectId + "/items/" + this._itemId + "/calculate"
            ).then(function (updated) {
                that.getView().getModel("item").setData(updated);
                MessageToast.show("Recalculated");
            });
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("project", { projectId: this._projectId });
        }
    });
});
