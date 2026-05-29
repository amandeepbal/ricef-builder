sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/Text",
    "sap/m/Panel",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "../../model/helpDialog"
], function (Controller, JSONModel, Dialog, Button, VBox, Text, Panel, Table, Column, ColumnListItem, helpDialog) {
    "use strict";

    var TEAM_TO_CAT = { DEV: "CLASSIFICATION_DEV", BI: "CLASSIFICATION_BI", MIGRATION: "CLASSIFICATION_MIG" };

    return Controller.extend("com.syntax.ricefbuilder.controller.admin.ComplexityDefs", {
        _team: "DEV",
        _allDefs: [],

        onInit: function () {
            this.getView().setModel(new JSONModel([]), "defs");
            this.getOwnerComponent().getRouter().getRoute("adminComplexity")
                .attachPatternMatched(this._onRoute, this);
        },

        _onRoute: function () {
            this._loadAll();
        },

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
            if (!obj.factors || obj.factors.length === 0) {
                sap.m.MessageToast.show("No complexity factors defined for this classification.");
                return;
            }
            this._showFactorsDialog(obj);
        },

        _showFactorsDialog: function (obj) {
            var complexities = ["Very Low", "Low", "Medium", "High", "Very High"];
            var content = new VBox({ class: "sapUiSmallMargin" });

            obj.factors.forEach(function (f) {
                var panel = new Panel({ headerText: f.factor_name, expandable: true, expanded: true });
                var table = new Table({
                    columns: complexities.map(function (c) {
                        return new Column({ header: new Text({ text: c }), hAlign: "Center" });
                    })
                });
                table.addItem(new ColumnListItem({
                    cells: [
                        new Text({ text: f.value_very_low || "-" }),
                        new Text({ text: f.value_low || "-" }),
                        new Text({ text: f.value_medium || "-" }),
                        new Text({ text: f.value_high || "-" }),
                        new Text({ text: f.value_very_high || "-" })
                    ]
                }));
                panel.addContent(table);
                content.addItem(panel);
            });

            var dialog = new Dialog({
                title: "Complexity Factors: " + obj._classificationKey,
                contentWidth: "44rem",
                draggable: true,
                resizable: true,
                content: [content],
                endButton: new Button({
                    text: "Close",
                    press: function () { dialog.close(); }
                }),
                afterClose: function () { dialog.destroy(); }
            });
            dialog.addStyleClass("sapUiSizeCompact");
            dialog.open();
        },

        onHelp: function () {
            helpDialog.show("adminComplexity");
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("admin");
        }
    });
});
