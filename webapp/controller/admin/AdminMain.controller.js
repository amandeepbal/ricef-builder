sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/DatePicker",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/Button",
    "sap/m/MessageToast",
    "../../model/helpDialog"
], function (Controller, JSONModel, Dialog, Input, Label, DatePicker, SimpleForm, Button, MessageToast, helpDialog) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.admin.AdminMain", {
        onInit: function () {
            this.getView().setModel(new JSONModel([]), "versions");
            var adminCtx = this.getOwnerComponent().getModel("adminCtx");
            if (!adminCtx) {
                adminCtx = new JSONModel({ versionId: 1 });
                this.getOwnerComponent().setModel(adminCtx, "adminCtx");
            }
            this.getView().setModel(adminCtx, "adminCtx");
            this.getOwnerComponent().getRouter().getRoute("admin")
                .attachPatternMatched(this._onRoute, this);
        },

        _onRoute: function () {
            this._loadVersions();
        },

        _loadVersions: function () {
            var that = this;
            this.getOwnerComponent().api("GET", "/admin/config-versions").then(function (data) {
                that.getView().getModel("versions").setData(data);

                var today = new Date().toISOString().slice(0, 10);
                var current = data.find(function (v) {
                    return v.is_active && v.valid_from <= today && (!v.valid_to || v.valid_to >= today);
                });
                if (current) {
                    that.getOwnerComponent().getModel("adminCtx").setProperty("/versionId", current.id);
                }
            });
        },

        onVersionChange: function (oEvent) {
            var key = oEvent.getParameter("selectedItem").getKey();
            this.getOwnerComponent().getModel("adminCtx").setProperty("/versionId", parseInt(key));
        },

        onEditVersion: function () {
            var that = this;
            var vid = this.getOwnerComponent().getModel("adminCtx").getProperty("/versionId");
            this.getOwnerComponent().api("GET", "/admin/config-versions/" + vid).then(function (ver) {
                var oName = new Input({ value: ver.name });
                var oFrom = new DatePicker({ value: ver.valid_from, valueFormat: "yyyy-MM-dd", displayFormat: "MMM dd, yyyy" });
                var oTo = new DatePicker({ value: ver.valid_to || "", valueFormat: "yyyy-MM-dd", displayFormat: "MMM dd, yyyy", placeholder: "Open-ended if empty" });

                var dialog = new Dialog({
                    title: "Edit Config Version",
                    type: "Message",
                    content: new SimpleForm({
                        editable: true,
                        content: [
                            new Label({ text: "Name" }), oName,
                            new Label({ text: "Valid From" }), oFrom,
                            new Label({ text: "Valid To" }), oTo
                        ]
                    }),
                    beginButton: new Button({
                        text: "Save", type: "Emphasized",
                        press: function () {
                            if (!oName.getValue().trim() || !oFrom.getValue()) {
                                MessageToast.show("Name and Valid From are required");
                                return;
                            }
                            that.getOwnerComponent().api("PUT", "/admin/config-versions/" + vid, {
                                name: oName.getValue().trim(),
                                description: ver.description,
                                valid_from: oFrom.getValue(),
                                valid_to: oTo.getValue() || null,
                                is_active: ver.is_active
                            }).then(function () {
                                MessageToast.show("Version updated");
                                dialog.close();
                                that._loadVersions();
                            }).catch(function (err) {
                                MessageToast.show(err.message || "Failed to update version");
                            });
                        }
                    }),
                    endButton: new Button({ text: "Cancel", press: function () { dialog.close(); } }),
                    afterClose: function () { dialog.destroy(); }
                });
                dialog.open();
            });
        },

        onCreateVersion: function () {
            var that = this;
            var oName = new Input({ placeholder: "e.g. 2026 Rates" });
            var oFrom = new DatePicker({ valueFormat: "yyyy-MM-dd", displayFormat: "MMM dd, yyyy", placeholder: "Valid from" });
            var oTo = new DatePicker({ valueFormat: "yyyy-MM-dd", displayFormat: "MMM dd, yyyy", placeholder: "Valid to (optional)" });

            var dialog = new Dialog({
                title: "New Config Version",
                type: "Message",
                content: new SimpleForm({
                    editable: true,
                    content: [
                        new Label({ text: "Name" }), oName,
                        new Label({ text: "Valid From" }), oFrom,
                        new Label({ text: "Valid To" }), oTo
                    ]
                }),
                beginButton: new Button({
                    text: "Create Empty", type: "Emphasized",
                    press: function () {
                        if (!oName.getValue().trim() || !oFrom.getValue()) {
                            MessageToast.show("Name and Valid From are required");
                            return;
                        }
                        that.getOwnerComponent().api("POST", "/admin/config-versions", {
                            name: oName.getValue().trim(),
                            valid_from: oFrom.getValue(),
                            valid_to: oTo.getValue() || null
                        }).then(function () {
                            MessageToast.show("Version created");
                            dialog.close();
                            that._loadVersions();
                        }).catch(function (err) {
                            MessageToast.show(err.message || "Failed to create version");
                        });
                    }
                }),
                endButton: new Button({ text: "Cancel", press: function () { dialog.close(); } }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.open();
        },

        onCloneVersion: function () {
            var that = this;
            var srcId = this.getOwnerComponent().getModel("adminCtx").getProperty("/versionId");
            var oName = new Input({ placeholder: "e.g. 2026 Rates" });
            var oFrom = new DatePicker({ valueFormat: "yyyy-MM-dd", displayFormat: "MMM dd, yyyy", placeholder: "Valid from" });
            var oTo = new DatePicker({ valueFormat: "yyyy-MM-dd", displayFormat: "MMM dd, yyyy", placeholder: "Valid to (optional)" });

            var dialog = new Dialog({
                title: "Clone Current Version",
                type: "Message",
                content: new SimpleForm({
                    editable: true,
                    content: [
                        new Label({ text: "New Name" }), oName,
                        new Label({ text: "Valid From" }), oFrom,
                        new Label({ text: "Valid To" }), oTo
                    ]
                }),
                beginButton: new Button({
                    text: "Clone", type: "Emphasized",
                    press: function () {
                        if (!oName.getValue().trim() || !oFrom.getValue()) {
                            MessageToast.show("Name and Valid From are required");
                            return;
                        }
                        that.getOwnerComponent().api("POST", "/admin/config-versions/" + srcId + "/clone", {
                            name: oName.getValue().trim(),
                            valid_from: oFrom.getValue(),
                            valid_to: oTo.getValue() || null
                        }).then(function (data) {
                            MessageToast.show("Version cloned");
                            dialog.close();
                            that._loadVersions();
                            that.getOwnerComponent().getModel("adminCtx").setProperty("/versionId", data.id);
                        }).catch(function (err) {
                            MessageToast.show(err.message || "Failed to clone version");
                        });
                    }
                }),
                endButton: new Button({ text: "Cancel", press: function () { dialog.close(); } }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.open();
        },

        onHelp: function () { helpDialog.show("admin"); },

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
