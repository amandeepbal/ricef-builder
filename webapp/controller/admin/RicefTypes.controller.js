sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog", "sap/m/Input", "sap/m/Label", "sap/m/Select",
    "sap/ui/core/Item", "sap/ui/layout/form/SimpleForm",
    "sap/m/Button", "sap/m/MessageToast"
], function (Controller, JSONModel, Dialog, Input, Label, Select, Item, SimpleForm, Button, MessageToast) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.admin.RicefTypes", {
        onInit: function () {
            this.getView().setModel(new JSONModel([]), "types");
            this.getOwnerComponent().getRouter().getRoute("adminRicefTypes")
                .attachPatternMatched(this._load, this);
        },

        _load: function () {
            var that = this;
            this.getOwnerComponent().api("GET", "/admin/ricef-types").then(function (data) {
                that.getView().getModel("types").setData(data);
            });
        },

        onToggle: function (oEvent) {
            var id = oEvent.getSource().data("id");
            this.getOwnerComponent().api("PATCH", "/admin/ricef-types/" + id + "/toggle");
        },

        onAdd: function () {
            this._openDialog();
        },

        onEdit: function (oEvent) {
            var ctx = oEvent.getSource().getBindingContext("types");
            this._openDialog(ctx.getObject());
        },

        _openDialog: function (existing) {
            var that = this;
            var isEdit = !!existing;
            var oCode = new Input({ value: existing ? existing.code : "" });
            var oLabel = new Input({ value: existing ? existing.label : "" });
            var oFrom = new Input({ value: existing ? existing.seq_from : "", type: "Number" });
            var oTo = new Input({ value: existing ? existing.seq_to : "", type: "Number" });
            var oSheet = new Select({
                selectedKey: existing ? existing.sheet_type_code : "RICEF",
                items: [
                    new Item({ key: "RICEF", text: "RICEF" }),
                    new Item({ key: "BI", text: "BI" }),
                    new Item({ key: "MIGRATION", text: "MIGRATION" }),
                    new Item({ key: "FUNCTIONAL", text: "FUNCTIONAL" })
                ]
            });

            var dialog = new Dialog({
                title: isEdit ? "Edit RICEF Type" : "Add RICEF Type",
                content: new SimpleForm({
                    editable: true,
                    content: [
                        new Label({ text: "Code" }), oCode,
                        new Label({ text: "Label" }), oLabel,
                        new Label({ text: "Seq From" }), oFrom,
                        new Label({ text: "Seq To" }), oTo,
                        new Label({ text: "Sheet Type" }), oSheet
                    ]
                }),
                beginButton: new Button({
                    text: "Save", type: "Emphasized",
                    press: function () {
                        var payload = {
                            code: oCode.getValue(),
                            label: oLabel.getValue(),
                            full_label: oCode.getValue() + " - " + oLabel.getValue(),
                            seq_from: parseInt(oFrom.getValue()),
                            seq_to: parseInt(oTo.getValue()),
                            sheet_type_code: oSheet.getSelectedKey(),
                            sort_order: existing ? existing.sort_order : 0,
                            is_active: existing ? existing.is_active : 1
                        };
                        var method = isEdit ? "PUT" : "POST";
                        var url = isEdit ? "/admin/ricef-types/" + existing.id : "/admin/ricef-types";
                        that.getOwnerComponent().api(method, url, payload).then(function () {
                            MessageToast.show("Saved");
                            dialog.close();
                            that._load();
                        });
                    }
                }),
                endButton: new Button({ text: "Cancel", press: function () { dialog.close(); } }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.open();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("admin");
        }
    });
});
