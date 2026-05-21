sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/IconTabFilter",
    "sap/m/MessageToast"
], function (Controller, JSONModel, IconTabFilter, MessageToast) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.admin.BlendedRates", {
        _configs: [],
        _currentConfigId: null,

        onInit: function () {
            this.getView().setModel(new JSONModel({}), "rates");
            this.getOwnerComponent().getRouter().getRoute("adminRates")
                .attachPatternMatched(this._load, this);
        },

        _load: function () {
            var that = this;
            this.getOwnerComponent().api("GET", "/admin/blended-rates").then(function (data) {
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
            this.getView().getModel("rates").setData(config);
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

            Promise.all([saveEffort].concat(saveRates)).then(function () {
                MessageToast.show("Blended rates saved");
                that._load();
            });
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("admin");
        }
    });
});
