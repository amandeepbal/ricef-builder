sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/IconTabFilter",
    "sap/m/MessageToast",
    "../../model/helpDialog"
], function (Controller, JSONModel, IconTabFilter, MessageToast, helpDialog) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.admin.BlendedRates", {
        _configs: [],
        _currentConfigId: null,

        onInit: function () {
            this.getView().setModel(new JSONModel({}), "rates");
            this.getOwnerComponent().getRouter().getRoute("adminRates")
                .attachPatternMatched(this._load, this);
        },

        _getVersionId: function () {
            var m = this.getOwnerComponent().getModel("adminCtx");
            return (m && m.getProperty("/versionId")) || 1;
        },

        _load: function () {
            var that = this;
            this.getOwnerComponent().api("GET", "/admin/blended-rates?version_id=" + this._getVersionId()).then(function (data) {
                that._configs = data;
                var tabs = that.byId("teamTabs");
                tabs.removeAllItems();
                data.forEach(function (c) {
                    tabs.addItem(new IconTabFilter({ key: String(c.id), text: c.team_label }));
                });
                if (data.length > 0) {
                    tabs.setSelectedKey(String(data[0].id));
                    that._currentConfigId = data[0].id;
                    that._showConfig(data[0]);
                }
            });
        },

        onTabSelect: function (oEvent) {
            var key = oEvent.getParameter("key");
            var config = this._configs.find(function (c) { return String(c.id) === key; });
            if (config) {
                this._currentConfigId = config.id;
                this._showConfig(config);
            }
        },

        _showConfig: function (config) {
            var allRates = [];
            (config.delivery_levels || []).forEach(function (level) {
                (level.rates || []).forEach(function (r) {
                    allRates.push({
                        level_id: level.id,
                        level_label: level.level_label,
                        currency: r.currency,
                        billable_rate: r.billable_rate,
                        effort_multiplier: r.effort_multiplier,
                        blended_cost: r.blended_cost,
                        margin_pct: r.margin_pct
                    });
                });
            });
            config.allRates = allRates;
            this._teamComposition = config.team_composition || [];
            var levelSel = this.byId("teamLevelSelect");
            var lvl = parseInt(levelSel.getSelectedKey()) || 1;
            config.teamRows = this._teamComposition.filter(function (t) { return t.level_number === lvl; });
            this.getView().getModel("rates").setData(config);
        },

        onTeamLevelChange: function () {
            var lvl = parseInt(this.byId("teamLevelSelect").getSelectedKey()) || 1;
            var model = this.getView().getModel("rates");
            model.setProperty("/teamRows", this._teamComposition.filter(function (t) { return t.level_number === lvl; }));
        },

        onAddTeamRow: function () {
            var lvl = parseInt(this.byId("teamLevelSelect").getSelectedKey()) || 1;
            var row = { level_number: lvl, multi: 0, complexity: "", individual: "", weight: 0, col_ref: 0 };
            this._teamComposition.push(row);
            var model = this.getView().getModel("rates");
            model.setProperty("/teamRows", this._teamComposition.filter(function (t) { return t.level_number === lvl; }));
        },

        onDeleteTeamRow: function (oEvent) {
            var obj = oEvent.getSource().getBindingContext("rates").getObject();
            var idx = this._teamComposition.indexOf(obj);
            if (idx >= 0) this._teamComposition.splice(idx, 1);
            var lvl = parseInt(this.byId("teamLevelSelect").getSelectedKey()) || 1;
            var model = this.getView().getModel("rates");
            model.setProperty("/teamRows", this._teamComposition.filter(function (t) { return t.level_number === lvl; }));
        },

        onSaveAll: function () {
            var that = this;
            var model = this.getView().getModel("rates");
            var configId = this._currentConfigId;

            var effortItems = model.getProperty("/effort_by_complexity").map(function (e) {
                return { complexity: e.complexity, multiplier: parseFloat(e.multiplier) };
            });
            var saveEffort = this.getOwnerComponent().api("PUT",
                "/admin/blended-rates/" + configId + "/effort-by-complexity",
                { items: effortItems }
            );

            var ratesByLevel = {};
            model.getProperty("/allRates").forEach(function (r) {
                if (!ratesByLevel[r.level_id]) ratesByLevel[r.level_id] = [];
                ratesByLevel[r.level_id].push({
                    currency: r.currency,
                    billable_rate: parseFloat(r.billable_rate),
                    effort_multiplier: parseFloat(r.effort_multiplier),
                    blended_cost: parseFloat(r.blended_cost),
                    margin_pct: parseFloat(r.margin_pct)
                });
            });

            var saveRates = Object.keys(ratesByLevel).map(function (levelId) {
                return that.getOwnerComponent().api("PUT",
                    "/admin/blended-rates/" + configId + "/levels/" + levelId + "/rates",
                    { rates: ratesByLevel[levelId] }
                );
            });

            var saveDist = this.getOwnerComponent().api("PUT",
                "/admin/blended-rates/" + configId + "/complexity-dist",
                { items: model.getProperty("/complexity_dist").map(function (d) {
                    return { level_number: d.level_number, pct_low: parseFloat(d.pct_low), pct_med: parseFloat(d.pct_med),
                             pct_high: parseFloat(d.pct_high), pct_vhigh: parseFloat(d.pct_vhigh) };
                })}
            );

            var saveTeam = this.getOwnerComponent().api("PUT",
                "/admin/blended-rates/" + configId + "/team-composition",
                { items: this._teamComposition.map(function (t) {
                    return { level_number: t.level_number, multi: parseFloat(t.multi), complexity: t.complexity,
                             individual: t.individual, weight: parseFloat(t.weight), col_ref: parseInt(t.col_ref) || 0 };
                })}
            );

            Promise.all([saveEffort, saveDist, saveTeam].concat(saveRates)).then(function () {
                MessageToast.show("Blended rates saved");
                that._load();
            });
        },

        onHelp: function () {
            helpDialog.show("adminRates");
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("admin");
        }
    });
});
