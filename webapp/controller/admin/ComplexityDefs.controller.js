sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "../../model/helpDialog"
], function (Controller, JSONModel, MessageToast, helpDialog) {
    "use strict";

    var TEAM_TO_CAT = { DEV: "CLASSIFICATION_DEV", BI: "CLASSIFICATION_BI", MIGRATION: "CLASSIFICATION_MIG" };

    return Controller.extend("com.syntax.ricefbuilder.controller.admin.ComplexityDefs", {
        _team: "DEV",
        _saveTimer: null,
        _allDefs: [],
        _allDropdowns: [],

        onInit: function () {
            this.getView().setModel(new JSONModel([]), "defs");
            this.getView().setModel(new JSONModel([]), "classifs");
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
            var that = this;
            var catCode = TEAM_TO_CAT[this._team];

            // Fetch classification dropdown values for this team
            this.getOwnerComponent().api("GET", "/admin/dropdowns/" + catCode + "?version_id=" + this._getVersionId()).then(function (cat) {
                var classifValues = (cat.values || []).filter(function (v) {
                    return v.is_active && !v.is_separator && v.value !== "TOTAL";
                });
                that.getView().getModel("classifs").setData(classifValues);
            });

            // Filter defs by team and add composite key
            var filtered = this._allDefs.filter(function (d) { return d.team === that._team; });
            filtered.forEach(function (d) {
                d._classificationKey = d.classification_group + " / " + d.subgroup;
            });
            this.getView().getModel("defs").setData(filtered);
        },

        onTeamSelect: function (oEvent) {
            this._team = oEvent.getParameter("key");
            this._applyFilter();
        },

        onClassificationChange: function (oEvent) {
            var ctx = oEvent.getSource().getBindingContext("defs");
            var obj = ctx.getObject();
            var selected = oEvent.getParameter("selectedItem").getKey();

            // Split "FRICE / Classification" into group + subgroup
            var slashPos = selected.indexOf(" / ");
            if (slashPos > 0) {
                obj.classification_group = selected.substring(0, slashPos);
                obj.subgroup = selected.substring(slashPos + 3);
            } else {
                obj.classification_group = selected;
                obj.subgroup = selected;
            }
            obj._classificationKey = selected;
            this._saveRow(obj);
        },

        onFieldChange: function (oEvent) {
            var obj = oEvent.getSource().getBindingContext("defs").getObject();
            this._saveRow(obj);
        },

        _saveRow: function (obj) {
            var that = this;
            if (this._saveTimer) clearTimeout(this._saveTimer);
            this._saveTimer = setTimeout(function () {
                that.getOwnerComponent().api("PUT", "/admin/complexity-definitions/" + obj.id, obj)
                    .then(function () { MessageToast.show("Saved"); });
            }, 500);
        },

        onAdd: function () {
            var that = this;
            this.getOwnerComponent().api("POST", "/admin/complexity-definitions", {
                version_id: this._getVersionId(),
                team: this._team, classification_group: "New", subgroup: "New",
                func_very_low: 0, func_low: 0, func_medium: 0, func_high: 0, func_very_high: 0,
                tech_very_low: 0, tech_low: 0, tech_medium: 0, tech_high: 0, tech_very_high: 0
            }).then(function () {
                that._loadAll();
                MessageToast.show("Added");
            });
        },

        onDelete: function (oEvent) {
            var obj = oEvent.getSource().getBindingContext("defs").getObject();
            var that = this;
            this.getOwnerComponent().api("DELETE", "/admin/complexity-definitions/" + obj.id)
                .then(function () {
                    that._loadAll();
                    MessageToast.show("Deleted");
                });
        },

        onHelp: function () {
            helpDialog.show("adminComplexity");
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("admin");
        }
    });
});
