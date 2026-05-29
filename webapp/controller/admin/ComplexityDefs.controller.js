sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/MessageToast",
    "sap/m/ScrollContainer",
    "../../model/helpDialog"
], function (Controller, JSONModel, Dialog, Button, VBox, HBox, Text, Input, Label, Table,
             Column, ColumnListItem, Toolbar, ToolbarSpacer, MessageToast, ScrollContainer, helpDialog) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.admin.ComplexityDefs", {
        _team: "DEV",
        _allDefs: [],

        onInit: function () {
            this.getView().setModel(new JSONModel([]), "defs");
            this.getOwnerComponent().getRouter().getRoute("adminComplexity")
                .attachPatternMatched(this._onRoute, this);
        },

        _onRoute: function () { this._loadAll(); },

        _getVersionId: function () {
            var m = this.getOwnerComponent().getModel("adminCtx");
            return (m && m.getProperty("/versionId")) || 1;
        },

        _loadAll: function () {
            var that = this;
            this.getOwnerComponent().api("GET", "/admin/complexity-definitions?version_id=" + this._getVersionId()).then(function (data) {
                that._allDefs = data;
                that._applyFilter();
            });
        },

        _applyFilter: function () {
            var team = this._team;
            var filtered = this._allDefs.filter(function (d) { return d.team === team; });
            this.getView().getModel("defs").setData(filtered);
        },

        onTeamSelect: function (oEvent) {
            this._team = oEvent.getParameter("key");
            this._applyFilter();
        },

        onRowPress: function (oEvent) {
            var obj = oEvent.getSource().getBindingContext("defs").getObject();
            this._openFactorEditor(obj);
        },

        _openFactorEditor: function (obj) {
            var that = this;
            var factors = (obj.factors || []).map(function (f, i) {
                return {
                    factor_name: f.factor_name || "",
                    value_very_low: f.value_very_low || "",
                    value_low: f.value_low || "",
                    value_medium: f.value_medium || "",
                    value_high: f.value_high || "",
                    value_very_high: f.value_very_high || "",
                    sort_order: i + 1
                };
            });
            var oModel = new JSONModel({ factors: factors });

            var COLS = [
                { key: "factor_name", label: "Factor", width: "12rem" },
                { key: "value_very_low", label: "Very Low" },
                { key: "value_low", label: "Low" },
                { key: "value_medium", label: "Medium" },
                { key: "value_high", label: "High" },
                { key: "value_very_high", label: "Very High" }
            ];

            var oTable = new Table({
                growing: false,
                columns: COLS.map(function (c) {
                    return new Column({
                        width: c.width || "8rem",
                        header: new Text({ text: c.label })
                    });
                }).concat([new Column({ width: "3rem" })])
            });

            oTable.bindItems({
                path: "edit>/factors",
                template: new ColumnListItem({
                    cells: COLS.map(function (c) {
                        return new Input({
                            value: "{edit>" + c.key + "}",
                            placeholder: c.key === "factor_name" ? "Factor name" : "-"
                        });
                    }).concat([
                        new Button({
                            icon: "sap-icon://delete",
                            type: "Reject",
                            press: function (oEvent) {
                                var path = oEvent.getSource().getBindingContext("edit").getPath();
                                var idx = parseInt(path.split("/").pop());
                                var arr = oModel.getProperty("/factors");
                                arr.splice(idx, 1);
                                oModel.setProperty("/factors", arr);
                            }
                        })
                    ])
                })
            });

            var oToolbar = new Toolbar({
                content: [
                    new Text({ text: factors.length + " factor" + (factors.length !== 1 ? "s" : "") }).addStyleClass("sapUiSmallMarginBegin"),
                    new ToolbarSpacer(),
                    new Button({
                        text: "Add Factor",
                        icon: "sap-icon://add",
                        press: function () {
                            var arr = oModel.getProperty("/factors");
                            arr.push({
                                factor_name: "",
                                value_very_low: "", value_low: "", value_medium: "",
                                value_high: "", value_very_high: "",
                                sort_order: arr.length + 1
                            });
                            oModel.setProperty("/factors", arr);
                        }
                    })
                ]
            });

            var oScroll = new ScrollContainer({
                height: "100%",
                vertical: true,
                content: [oToolbar, oTable]
            });

            var dialog = new Dialog({
                title: "Edit Factors: " + obj._classificationKey,
                contentWidth: "58rem",
                contentHeight: "60vh",
                draggable: true,
                resizable: true,
                content: [oScroll],
                beginButton: new Button({
                    text: "Save",
                    type: "Emphasized",
                    press: function () {
                        var updated = oModel.getProperty("/factors").filter(function (f) {
                            return f.factor_name && f.factor_name.trim();
                        });
                        updated.forEach(function (f, i) { f.sort_order = i + 1; });
                        that._saveFactors(obj, updated, dialog);
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () { dialog.close(); }
                }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.setModel(oModel, "edit");
            dialog.addStyleClass("sapUiSizeCompact");
            dialog.open();
        },

        _saveFactors: function (obj, factors, dialog) {
            var that = this;

            if (obj.id) {
                this.getOwnerComponent().api("PUT", "/admin/complexity-definitions/" + obj.id, {
                    team: obj.team,
                    classification_group: obj.classification_group,
                    subgroup: obj.subgroup,
                    factors: factors
                }).then(function () {
                    MessageToast.show("Factors saved");
                    dialog.close();
                    that._loadAll();
                });
            } else {
                this.getOwnerComponent().api("POST", "/admin/complexity-definitions", {
                    version_id: that._getVersionId(),
                    team: obj.team,
                    classification_group: obj.classification_group,
                    subgroup: obj.subgroup
                }).then(function (result) {
                    return that.getOwnerComponent().api("PUT", "/admin/complexity-definitions/" + result.id, {
                        team: obj.team,
                        classification_group: obj.classification_group,
                        subgroup: obj.subgroup,
                        factors: factors
                    });
                }).then(function () {
                    MessageToast.show("Factors created");
                    dialog.close();
                    that._loadAll();
                });
            }
        },

        onHelp: function () { helpDialog.show("adminComplexity"); },

        onNavBack: function () { this.getOwnerComponent().getRouter().navTo("admin"); }
    });
});
