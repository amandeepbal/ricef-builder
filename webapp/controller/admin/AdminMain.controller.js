sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/Button",
    "sap/m/MessageToast",
    "../../model/helpDialog"
], function (Controller, JSONModel, Dialog, Input, Label, List, StandardListItem, SimpleForm, Button, MessageToast, helpDialog) {
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
                if (data.length > 0) {
                    var ctx = that.getOwnerComponent().getModel("adminCtx");
                    var currentId = ctx.getProperty("/versionId");
                    var exists = data.some(function (v) { return v.id === currentId; });
                    if (!exists) {
                        ctx.setProperty("/versionId", data[0].id);
                    }
                }
            });
        },

        onVersionChange: function (oEvent) {
            var key = oEvent.getParameter("selectedItem").getKey();
            this.getOwnerComponent().getModel("adminCtx").setProperty("/versionId", parseInt(key));
        },

        _buildProjectList: function (allProjects, allVersions, currentVersionId) {
            var versionMap = {};
            allVersions.forEach(function (v) { versionMap[v.id] = v.name; });

            var oList = new List({ mode: "MultiSelect", noDataText: "No projects" });
            allProjects.forEach(function (p) {
                var isOnThisVersion = p.config_version_id === currentVersionId;
                var otherVersionName = !isOnThisVersion && p.config_version_id ? versionMap[p.config_version_id] : null;
                var desc = otherVersionName ? "Currently on: " + otherVersionName : "";
                var item = new StandardListItem({
                    title: p.project_number + " — " + p.description,
                    description: desc,
                    selected: isOnThisVersion
                });
                item.data("projectId", p.id);
                oList.addItem(item);
            });
            return oList;
        },

        onEditVersion: function () {
            var that = this;
            var vid = this.getOwnerComponent().getModel("adminCtx").getProperty("/versionId");

            Promise.all([
                this.getOwnerComponent().api("GET", "/admin/config-versions/" + vid),
                this.getOwnerComponent().api("GET", "/projects"),
                this.getOwnerComponent().api("GET", "/admin/config-versions")
            ]).then(function (results) {
                var ver = results[0];
                var allProjects = results[1];
                var allVersions = results[2];

                var oName = new Input({ value: ver.name });
                var isTemplate = vid === 1;
                var formContent = [new Label({ text: "Name" }), oName];

                if (isTemplate) {
                    formContent.push(new sap.m.MessageStrip({
                        text: "Template is a baseline config — projects cannot be assigned to it. Clone this version to create a project-specific config.",
                        type: "Warning", showIcon: true
                    }));
                } else {
                    var oProjectList = that._buildProjectList(allProjects, allVersions, vid);
                    formContent.push(new Label({ text: "Assigned Projects" }), oProjectList);
                }

                var dialog = new Dialog({
                    title: "Edit Config Version",
                    type: "Message",
                    contentWidth: "32rem",
                    content: new SimpleForm({
                        editable: true,
                        content: formContent
                    }),
                    beginButton: new Button({
                        text: "Save", type: "Emphasized",
                        press: function () {
                            if (!oName.getValue().trim()) {
                                MessageToast.show("Name is required");
                                return;
                            }
                            var calls = [
                                that.getOwnerComponent().api("PUT", "/admin/config-versions/" + vid, {
                                    name: oName.getValue().trim(),
                                    description: ver.description,
                                    is_active: ver.is_active
                                })
                            ];
                            if (!isTemplate) {
                                var selectedIds = oProjectList.getSelectedItems().map(function (item) {
                                    return item.data("projectId");
                                });
                                calls.push(that.getOwnerComponent().api("PUT", "/admin/config-versions/" + vid + "/projects", {
                                    project_ids: selectedIds
                                }));
                            }
                            Promise.all(calls).then(function () {
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
            var oName = new Input({ placeholder: "e.g. 2026 Rate Card" });

            Promise.all([
                this.getOwnerComponent().api("GET", "/projects"),
                this.getOwnerComponent().api("GET", "/admin/config-versions")
            ]).then(function (results) {
                var allProjects = results[0];
                var allVersions = results[1];
                var oProjectList = that._buildProjectList(allProjects, allVersions, null);

                var dialog = new Dialog({
                    title: "New Config Version",
                    type: "Message",
                    contentWidth: "32rem",
                    content: new SimpleForm({
                        editable: true,
                        content: [
                            new Label({ text: "Name" }), oName,
                            new Label({ text: "Assign Projects" }), oProjectList
                        ]
                    }),
                    beginButton: new Button({
                        text: "Create Empty", type: "Emphasized",
                        press: function () {
                            if (!oName.getValue().trim()) {
                                MessageToast.show("Name is required");
                                return;
                            }
                            that.getOwnerComponent().api("POST", "/admin/config-versions", {
                                name: oName.getValue().trim()
                            }).then(function (data) {
                                var selectedIds = oProjectList.getSelectedItems().map(function (item) {
                                    return item.data("projectId");
                                });
                                if (selectedIds.length > 0) {
                                    return that.getOwnerComponent().api("PUT", "/admin/config-versions/" + data.id + "/projects", {
                                        project_ids: selectedIds
                                    }).then(function () { return data; });
                                }
                                return data;
                            }).then(function (data) {
                                MessageToast.show("Version created");
                                dialog.close();
                                that._loadVersions();
                                that.getOwnerComponent().getModel("adminCtx").setProperty("/versionId", data.id);
                            }).catch(function (err) {
                                MessageToast.show(err.message || "Failed to create version");
                            });
                        }
                    }),
                    endButton: new Button({ text: "Cancel", press: function () { dialog.close(); } }),
                    afterClose: function () { dialog.destroy(); }
                });
                dialog.open();
            });
        },

        onCloneVersion: function () {
            var that = this;
            var srcId = this.getOwnerComponent().getModel("adminCtx").getProperty("/versionId");
            var oName = new Input({ placeholder: "e.g. 2027 Rate Card" });

            Promise.all([
                this.getOwnerComponent().api("GET", "/projects"),
                this.getOwnerComponent().api("GET", "/admin/config-versions")
            ]).then(function (results) {
                var allProjects = results[0];
                var allVersions = results[1];
                var oProjectList = that._buildProjectList(allProjects, allVersions, null);

                var dialog = new Dialog({
                    title: "Clone Current Version",
                    type: "Message",
                    contentWidth: "32rem",
                    content: new SimpleForm({
                        editable: true,
                        content: [
                            new Label({ text: "New Name" }), oName,
                            new Label({ text: "Assign Projects" }), oProjectList
                        ]
                    }),
                    beginButton: new Button({
                        text: "Clone", type: "Emphasized",
                        press: function () {
                            if (!oName.getValue().trim()) {
                                MessageToast.show("Name is required");
                                return;
                            }
                            that.getOwnerComponent().api("POST", "/admin/config-versions/" + srcId + "/clone", {
                                name: oName.getValue().trim()
                            }).then(function (data) {
                                var selectedIds = oProjectList.getSelectedItems().map(function (item) {
                                    return item.data("projectId");
                                });
                                if (selectedIds.length > 0) {
                                    return that.getOwnerComponent().api("PUT", "/admin/config-versions/" + data.id + "/projects", {
                                        project_ids: selectedIds
                                    }).then(function () { return data; });
                                }
                                return data;
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
            });
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
