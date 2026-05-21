sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog", "sap/m/Input", "sap/m/Label",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/Button", "sap/m/MessageToast"
], function (Controller, JSONModel, Dialog, Input, Label, SimpleForm, Button, MessageToast) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.admin.Dropdowns", {
        _selectedCode: null,

        onInit: function () {
            this.getView().setModel(new JSONModel([]), "cats");
            this.getView().setModel(new JSONModel([]), "vals");
            this.getOwnerComponent().getRouter().getRoute("adminDropdowns")
                .attachPatternMatched(this._load, this);
        },

        _load: function () {
            var that = this;
            this.getOwnerComponent().api("GET", "/admin/dropdowns").then(function (data) {
                that.getView().getModel("cats").setData(data);
            });
        },

        onCatSelect: function (oEvent) {
            var ctx = oEvent.getParameter("listItem").getBindingContext("cats");
            this._selectedCode = ctx.getProperty("code");
            this._loadValues();
        },

        _loadValues: function () {
            var that = this;
            this.getOwnerComponent().api("GET", "/admin/dropdowns/" + this._selectedCode)
                .then(function (data) {
                    that.getView().getModel("vals").setData(data.values || []);
                });
        },

        onAddValue: function () {
            if (!this._selectedCode) {
                MessageToast.show("Select a category first");
                return;
            }
            var that = this;
            var oInput = new Input({ placeholder: "New value" });
            var dialog = new Dialog({
                title: "Add Value to " + this._selectedCode,
                content: new SimpleForm({
                    editable: true,
                    content: [new Label({ text: "Value" }), oInput]
                }),
                beginButton: new Button({
                    text: "Add", type: "Emphasized",
                    press: function () {
                        that.getOwnerComponent().api("POST",
                            "/admin/dropdowns/" + that._selectedCode + "/values",
                            { value: oInput.getValue() }
                        ).then(function () {
                            MessageToast.show("Added");
                            dialog.close();
                            that._loadValues();
                        });
                    }
                }),
                endButton: new Button({ text: "Cancel", press: function () { dialog.close(); } }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.open();
        },

        onAddSeparator: function () {
            if (!this._selectedCode) {
                MessageToast.show("Select a category first");
                return;
            }
            var that = this;
            var oInput = new Input({ placeholder: "e.g. Interface" });
            var dialog = new Dialog({
                title: "Add Group Header to " + this._selectedCode,
                content: new SimpleForm({
                    editable: true,
                    content: [new Label({ text: "Group Name" }), oInput]
                }),
                beginButton: new Button({
                    text: "Add", type: "Emphasized",
                    press: function () {
                        var label = oInput.getValue().trim();
                        that.getOwnerComponent().api("POST",
                            "/admin/dropdowns/" + that._selectedCode + "/values",
                            { value: "----- " + label + " -------", is_separator: 1 }
                        ).then(function () {
                            MessageToast.show("Group header added");
                            dialog.close();
                            that._loadValues();
                        });
                    }
                }),
                endButton: new Button({ text: "Cancel", press: function () { dialog.close(); } }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.open();
        },

        onValueChange: function (oEvent) {
            var that = this;
            var obj = oEvent.getSource().getBindingContext("vals").getObject();
            if (this._saveTimer) clearTimeout(this._saveTimer);
            this._saveTimer = setTimeout(function () {
                that.getOwnerComponent().api("PUT",
                    "/admin/dropdowns/" + that._selectedCode + "/values/" + obj.id,
                    {
                        value: obj.value,
                        display_label: obj.display_label,
                        is_separator: obj.is_separator ? 1 : 0,
                        sort_order: parseInt(obj.sort_order) || 0,
                        is_active: obj.is_active ? 1 : 0
                    }
                ).then(function () { MessageToast.show("Saved"); });
            }, 500);
        },

        onInsertBelow: function (oEvent) {
            if (!this._selectedCode) return;
            var that = this;
            var obj = oEvent.getSource().getBindingContext("vals").getObject();
            var afterOrder = parseInt(obj.sort_order) || 0;

            var oInput = new Input({ placeholder: "New value" });
            var dialog = new Dialog({
                title: "Insert Value After: " + obj.value,
                content: new SimpleForm({
                    editable: true,
                    content: [new Label({ text: "Value" }), oInput]
                }),
                beginButton: new Button({
                    text: "Insert", type: "Emphasized",
                    press: function () {
                        var val = oInput.getValue().trim();
                        if (!val) {
                            MessageToast.show("Value is required");
                            return;
                        }
                        that.getOwnerComponent().api("POST",
                            "/admin/dropdowns/" + that._selectedCode + "/values",
                            { value: val, sort_order: afterOrder + 1, insert_after: afterOrder }
                        ).then(function () {
                            MessageToast.show("Inserted");
                            dialog.close();
                            that._loadValues();
                        });
                    }
                }),
                endButton: new Button({ text: "Cancel", press: function () { dialog.close(); } }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.open();
        },

        onDeleteValue: function (oEvent) {
            var that = this;
            var obj = oEvent.getSource().getBindingContext("vals").getObject();
            this.getOwnerComponent().api("DELETE",
                "/admin/dropdowns/" + this._selectedCode + "/values/" + obj.id
            ).then(function () {
                MessageToast.show("Deleted");
                that._loadValues();
            });
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("admin");
        }
    });
});
