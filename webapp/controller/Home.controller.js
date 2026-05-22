sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/Button",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "../model/helpDialog"
], function (Controller, JSONModel, Dialog, Input, Label, Select, Item, SimpleForm, Button, MessageToast, MessageBox, helpDialog) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.Home", {
        onInit: function () {
            this.getView().setModel(new JSONModel([]), "projects");
            this.getOwnerComponent().getRouter().getRoute("home").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this._loadProjects();
        },

        _loadProjects: function () {
            var that = this;
            this.getOwnerComponent().api("GET", "/projects").then(function (data) {
                that.getView().getModel("projects").setData(data);
            });
        },

        onProjectPress: function (oEvent) {
            var obj = oEvent.getSource().getBindingContext("projects").getObject();
            this.getOwnerComponent().getRouter().navTo("project", { projectId: obj.id });
        },

        onCopyProject: function (oEvent) {
            var project = oEvent.getSource().getBindingContext("projects").getObject();
            this._openCopyDialog(project);
        },

        onEditProject: function (oEvent) {
            var project = oEvent.getSource().getBindingContext("projects").getObject();
            this._openEditDialog(project);
        },

        onDeleteProject: function (oEvent) {
            var project = oEvent.getSource().getBindingContext("projects").getObject();
            this._deleteProject(project);
        },

        _openEditDialog: function (project) {
            var that = this;
            var oNumInput = new Input({ value: project.project_number });
            var oDescInput = new Input({ value: project.description });
            var oCurrSelect = new Select({
                selectedKey: project.currency || "USD",
                items: [
                    new Item({ key: "USD", text: "USD" }),
                    new Item({ key: "CAD", text: "CAD" }),
                    new Item({ key: "EUR", text: "EUR" })
                ]
            });
            var oStartDate = new sap.m.DatePicker({
                value: project.start_date || "",
                valueFormat: "yyyy-MM-dd", displayFormat: "MMM dd, yyyy"
            });
            var oEndDate = new sap.m.DatePicker({
                value: project.end_date || "",
                valueFormat: "yyyy-MM-dd", displayFormat: "MMM dd, yyyy"
            });
            var oVersionSelect = new Select({ selectedKey: String(project.config_version_id || 1) });

            that.getOwnerComponent().api("GET", "/admin/config-versions").then(function (versions) {
                versions.forEach(function (v) {
                    oVersionSelect.addItem(new Item({
                        key: String(v.id),
                        text: v.name + " (" + v.valid_from + (v.valid_to ? " — " + v.valid_to : " — open") + ")"
                    }));
                });
                oVersionSelect.setSelectedKey(String(project.config_version_id || 1));
            });

            var dialog = new Dialog({
                title: "Edit Project: " + project.description,
                type: "Message",
                content: new SimpleForm({
                    editable: true,
                    content: [
                        new Label({ text: "Project Number" }), oNumInput,
                        new Label({ text: "Description" }), oDescInput,
                        new Label({ text: "Start Date" }), oStartDate,
                        new Label({ text: "End Date" }), oEndDate,
                        new Label({ text: "Currency" }), oCurrSelect,
                        new Label({ text: "Config Version" }), oVersionSelect
                    ]
                }),
                beginButton: new Button({
                    text: "Save", type: "Emphasized",
                    press: function () {
                        that.getOwnerComponent().api("PUT", "/projects/" + project.id, {
                            project_number: oNumInput.getValue(),
                            description: oDescInput.getValue(),
                            start_date: oStartDate.getValue() || null,
                            end_date: oEndDate.getValue() || null,
                            currency: oCurrSelect.getSelectedKey(),
                            delivery_level: project.delivery_level,
                            config_version_id: parseInt(oVersionSelect.getSelectedKey())
                        }).then(function () {
                            MessageToast.show("Project updated");
                            dialog.close();
                            that._loadProjects();
                        });
                    }
                }),
                endButton: new Button({ text: "Cancel", press: function () { dialog.close(); } }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.open();
        },

        _openCopyDialog: function (sourceProject) {
            var that = this;
            var oNumInput = new Input({ value: sourceProject.project_number + "-COPY" });
            var oDescInput = new Input({ value: sourceProject.description + " (Copy)" });

            var dialog = new Dialog({
                title: "Copy Project: " + sourceProject.description,
                type: "Message",
                content: new SimpleForm({
                    editable: true,
                    content: [
                        new Label({ text: "New Project Number" }), oNumInput,
                        new Label({ text: "Description" }), oDescInput
                    ]
                }),
                beginButton: new Button({
                    text: "Copy",
                    type: "Emphasized",
                    press: function () {
                        var num = oNumInput.getValue().trim();
                        var desc = oDescInput.getValue().trim();
                        if (!num || !desc) {
                            MessageToast.show("Project number and description are required");
                            return;
                        }
                        that.getOwnerComponent().api("POST", "/projects/" + sourceProject.id + "/copy", {
                            project_number: num,
                            description: desc
                        }).then(function () {
                            MessageToast.show("Project copied");
                            dialog.close();
                            that._loadProjects();
                        }).catch(function (err) {
                            MessageToast.show(err.message || "Copy failed");
                        });
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () { dialog.close(); }
                }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.open();
        },

        _deleteProject: function (project) {
            var that = this;
            MessageBox.confirm("Delete project '" + project.description + "'?", {
                onClose: function (action) {
                    if (action === MessageBox.Action.OK) {
                        that.getOwnerComponent().api("DELETE", "/projects/" + project.id).then(function () {
                            MessageToast.show("Project deleted");
                            that._loadProjects();
                        });
                    }
                }
            });
        },

        onHelp: function () { helpDialog.show("home"); },

        onCreateProject: function () {
            var that = this;
            var oNumInput = new Input({ placeholder: "e.g. 1" });
            var oDescInput = new Input({ placeholder: "e.g. Client ABC - Implementation" });
            var oCurrSelect = new Select({
                items: [
                    new Item({ key: "USD", text: "USD" }),
                    new Item({ key: "CAD", text: "CAD" }),
                    new Item({ key: "EUR", text: "EUR" })
                ]
            });
            var levelDescriptions = {
                "1": "Standard SAP with minimal custom development. Lowest blended rate & effort multiplier.",
                "2": "Moderate customization with some complex integrations. Mid-range blended rate.",
                "3": "Heavy customization, complex landscape, high effort. Highest blended rate & multiplier."
            };
            var oLevelDesc = new sap.m.Text({ text: levelDescriptions["1"] });
            oLevelDesc.addStyleClass("sapUiTinyMarginBottom");
            var oLevelSelect = new Select({
                items: [
                    new Item({ key: "1", text: "1 : Minimal Adaptation" }),
                    new Item({ key: "2", text: "2 : Moderate Adaptation" }),
                    new Item({ key: "3", text: "3 : Significant Adaptation" })
                ],
                change: function (oEvent) {
                    oLevelDesc.setText(levelDescriptions[oEvent.getParameter("selectedItem").getKey()] || "");
                }
            });

            var oStartDate = new sap.m.DatePicker({ placeholder: "Project start", valueFormat: "yyyy-MM-dd", displayFormat: "MMM dd, yyyy" });
            var oEndDate = new sap.m.DatePicker({ placeholder: "Project end", valueFormat: "yyyy-MM-dd", displayFormat: "MMM dd, yyyy" });

            var dialog = new Dialog({
                title: "New Project",
                type: "Message",
                content: new SimpleForm({
                    editable: true,
                    content: [
                        new Label({ text: "Project Number" }), oNumInput,
                        new sap.m.Text({ text: "Unique identifier for the project (e.g., PRJ-001)" }).addStyleClass("sapUiTinyMarginBottom sapThemeMetaText"),
                        new Label({ text: "Description" }), oDescInput,
                        new sap.m.Text({ text: "Client name and project phase (e.g., Client ABC - Discovery Phase 1)" }).addStyleClass("sapUiTinyMarginBottom sapThemeMetaText"),
                        new Label({ text: "Start Date" }), oStartDate,
                        new Label({ text: "End Date" }), oEndDate,
                        new sap.m.Text({ text: "Config version is auto-resolved from start date" }).addStyleClass("sapUiTinyMarginBottom sapThemeMetaText"),
                        new Label({ text: "Currency" }), oCurrSelect,
                        new sap.m.Text({ text: "Determines blended rate currency for cost calculations" }).addStyleClass("sapUiTinyMarginBottom sapThemeMetaText"),
                        new Label({ text: "Delivery Level" }), oLevelSelect,
                        oLevelDesc
                    ]
                }),
                beginButton: new Button({
                    text: "Create",
                    type: "Emphasized",
                    press: function () {
                        that.getOwnerComponent().api("POST", "/projects", {
                            project_number: oNumInput.getValue(),
                            description: oDescInput.getValue(),
                            start_date: oStartDate.getValue() || null,
                            end_date: oEndDate.getValue() || null,
                            currency: oCurrSelect.getSelectedKey(),
                            delivery_level: parseInt(oLevelSelect.getSelectedKey())
                        }).then(function () {
                            MessageToast.show("Project created");
                            dialog.close();
                            that._loadProjects();
                        });
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () { dialog.close(); }
                }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.open();
        }
    });
});
