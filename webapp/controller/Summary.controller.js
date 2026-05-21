sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/ObjectNumber",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/MessageToast",
    "../model/formatter"
], function (Controller, JSONModel, Text, Label, ObjectNumber, SimpleForm, MessageToast, fmt) {
    "use strict";

    function cloneObj(o) { return JSON.parse(JSON.stringify(o)); }

    return Controller.extend("com.syntax.ricefbuilder.controller.Summary", {
        _projectId: null,
        _saveTimer: null,
        _factorsSaveTimer: null,

        onInit: function () {
            this.getView().setModel(new JSONModel({}), "summary");
            this.getView().setModel(new JSONModel({}), "ctrl");
            this.getOwnerComponent().getRouter().getRoute("summary")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            this._projectId = oEvent.getParameter("arguments").projectId;
            this._loadSummary();
            this._loadControl();
        },

        _loadSummary: function () {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/summary"
            ).then(function (data) {
                var funcArchRows = [];
                if (data.funcArchitect) funcArchRows.push(data.funcArchitect);
                (data.funcByRole || []).forEach(function (r) { funcArchRows.push(r); });
                data.funcArchRows = funcArchRows;

                that.getView().getModel("summary").setData(data);
                that.byId("totalItems").setNumber(data.itemCount);
                that.byId("totalFunc").setNumber(data.totalFunc);
                that.byId("totalTech").setNumber(data.totalTech);
                that.byId("totalGrand").setNumber(data.totalGrand);
                that._renderBlendedPanel("devBlendedPanel", data.devBlended);
                that._renderBlendedPanel("biBlendedPanel", data.biBlended);
                that._renderBlendedPanel("migBlendedPanel", data.migBlended);
            });
        },

        _loadControl: function () {
            var that = this;
            this.getOwnerComponent().api("GET",
                "/projects/" + this._projectId + "/control"
            ).then(function (data) {
                fmt.pctToDisplay(data.pgo, ["lead_split", "consultant_split"]);
                fmt.pctToDisplay(data.contingency);
                fmt.pctToDisplay(data.funcPhasePct, ["architect_pct"]);
                fmt.pctToDisplay(data.factors, ["cont_func_pct", "cont_tech_pct", "sit_func_pct", "sit_tech_pct"]);
                that.getView().getModel("ctrl").setData(data);
            });
        },

        onCtrlChange: function (oEvent) {
            var oSource = oEvent.getSource();
            var section = oSource.data("s");
            if (!section) return;

            var that = this;
            if (this._saveTimer) clearTimeout(this._saveTimer);
            this._saveTimer = setTimeout(function () {
                that._saveControl(section);
            }, 600);
        },

        _saveControl: function (section) {
            var oModel = this.getView().getModel("ctrl");
            var data, endpoint;

            switch (section) {
                case "phases":
                    data = cloneObj(oModel.getProperty("/phases"));
                    endpoint = "/projects/" + this._projectId + "/control/phases";
                    break;
                case "pgo":
                    data = cloneObj(oModel.getProperty("/pgo"));
                    fmt.pctFromDisplay(data, ["lead_split", "consultant_split"]);
                    endpoint = "/projects/" + this._projectId + "/control/pgo";
                    break;
                case "contingency":
                    data = cloneObj(oModel.getProperty("/contingency"));
                    fmt.pctFromDisplay(data);
                    endpoint = "/projects/" + this._projectId + "/control/contingency";
                    break;
                case "func-phase-pct":
                    data = cloneObj(oModel.getProperty("/funcPhasePct"));
                    fmt.pctFromDisplay(data, ["architect_pct"]);
                    endpoint = "/projects/" + this._projectId + "/control/func-phase-pct";
                    break;
                default:
                    return;
            }

            var that = this;
            this.getOwnerComponent().api("PUT", endpoint, data).then(function () {
                that._loadSummary();
                MessageToast.show("Settings saved — summary recalculated");
            });
        },

        onFactorsChange: function () {
            var that = this;
            if (this._factorsSaveTimer) clearTimeout(this._factorsSaveTimer);
            this._factorsSaveTimer = setTimeout(function () {
                var data = cloneObj(that.getView().getModel("ctrl").getProperty("/factors"));
                fmt.pctFromDisplay(data, ["cont_func_pct", "cont_tech_pct", "sit_func_pct", "sit_tech_pct"]);
                that.getOwnerComponent().api("PUT",
                    "/projects/" + that._projectId + "/control/factors", data
                ).then(function (res) {
                    that._loadSummary();
                    MessageToast.show("Factors saved — " + (res.recalculated || 0) + " items recalculated");
                });
            }, 1000);
        },

        _renderBlendedPanel: function (panelId, info) {
            var panel = this.byId(panelId);
            panel.removeAllContent();
            if (!info) {
                panel.addContent(new Text({ text: "No rate data" }));
                return;
            }
            panel.addContent(new SimpleForm({
                layout: "ResponsiveGridLayout", columnsL: 2, columnsM: 1,
                content: [
                    new Label({ text: "Delivery Level" }),
                    new Text({ text: info.level }),
                    new Label({ text: "Currency" }),
                    new Text({ text: info.currency }),
                    new Label({ text: "Billable Rate" }),
                    new ObjectNumber({ number: info.billable_rate, unit: info.currency }),
                    new Label({ text: "Effort Multiplier" }),
                    new ObjectNumber({ number: info.effort_multiplier }),
                    new Label({ text: "Blended Cost" }),
                    new ObjectNumber({ number: info.blended_cost, unit: info.currency }),
                    new Label({ text: "Margin %" }),
                    new ObjectNumber({ number: info.margin_pct, unit: "%" })
                ]
            }));
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("project", { projectId: this._projectId });
        }
    });
});
