sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Item",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/StepInput",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/Toolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/ObjectNumber",
    "sap/m/MessageToast",
    "sap/ui/layout/form/SimpleForm"
], function (Controller, JSONModel, Item, Dialog, Button, Label, StepInput,
             Text, Title, Toolbar, ToolbarSpacer, ObjectNumber, MessageToast, SimpleForm) {
    "use strict";

    return Controller.extend("com.syntax.ricefbuilder.controller.admin.EstimationGrid", {
        _allData: [],

        onInit: function () {
            this.getView().setModel(new JSONModel([]), "grid");
            this.getOwnerComponent().getRouter().getRoute("adminGrid")
                .attachPatternMatched(this._load, this);
        },

        _load: function () {
            var that = this;
            this.getOwnerComponent().api("GET", "/admin/estimation-grid").then(function (data) {
                that._allData = data;
                that.getView().getModel("grid").setData(data);
                var filter = that.byId("friceFilter");
                if (filter.getItems().length <= 1) {
                    var unique = {};
                    data.forEach(function (r) { unique[r.frice] = true; });
                    Object.keys(unique).sort().forEach(function (f) {
                        filter.addItem(new Item({ key: f, text: f }));
                    });
                }
            });
        },

        onFilter: function () {
            var key = this.byId("friceFilter").getSelectedKey();
            var filtered = key ? this._allData.filter(function (r) { return r.frice === key; }) : this._allData;
            this.getView().getModel("grid").setData(filtered);
        },

        onSearch: function (oEvent) {
            var q = (oEvent.getParameter("query") || "").toLowerCase();
            var filtered = this._allData.filter(function (r) {
                return !q || r.frice.toLowerCase().indexOf(q) >= 0 ||
                       r.classification.toLowerCase().indexOf(q) >= 0;
            });
            this.getView().getModel("grid").setData(filtered);
        },

        onRowPress: function (oEvent) {
            var obj = oEvent.getSource().getBindingContext("grid").getObject();
            this._openEditDialog(Object.assign({}, obj));
        },

        _openEditDialog: function (row) {
            var that = this;
            var editModel = new JSONModel(row);

            var fields = [
                { group: "Functional Specification (FS)", items: [
                    { key: "fs_bus_req",    label: "Business Requirements" },
                    { key: "fs_f_analysis", label: "Functional Analysis" },
                    { key: "fs_f_spec",     label: "Functional Spec" }
                ]},
                { group: "Development Analysis", items: [
                    { key: "dev_t_analysis", label: "Technical Analysis" },
                    { key: "dev_t_spec",     label: "Technical Spec" }
                ]},
                { group: "Development & Unit Test", items: [
                    { key: "dev_coding",   label: "Coding" },
                    { key: "dev_tt_cases", label: "Technical Test Cases" },
                    { key: "dev_ut",       label: "Unit Testing" }
                ]},
                { group: "Development Support", items: [
                    { key: "dev_qa", label: "Q&A Support" }
                ]},
                { group: "Functional Testing (FUT)", items: [
                    { key: "fut_f_tcases",  label: "Functional Test Cases" },
                    { key: "fut_test_data", label: "Test Data" },
                    { key: "fut_fut",       label: "Functional Testing" }
                ]},
                { group: "Break Fix", items: [
                    { key: "brk_fix", label: "Bug Fix" }
                ]}
            ];

            var formContent = [
                new Label({ text: "Baseline Hours", design: "Bold" }),
                new StepInput({
                    value: "{edit>/baseline}",
                    min: 0, max: 9999, step: 1,
                    displayValuePrecision: 1, width: "10rem",
                    change: function () { that._recalcTotals(editModel); }
                })
            ];

            fields.forEach(function (group) {
                formContent.push(new Title({ text: group.group }));
                group.items.forEach(function (f) {
                    formContent.push(new Label({ text: f.label }));
                    formContent.push(new StepInput({
                        value: "{edit>/" + f.key + "}",
                        min: 0, max: 9999, step: 0.1,
                        displayValuePrecision: 1, width: "10rem",
                        change: function () { that._recalcTotals(editModel); }
                    }));
                });
            });

            formContent.push(new Title({ text: "Calculated Totals" }));
            formContent.push(new Label({ text: "FUNC Total", design: "Bold" }));
            formContent.push(new ObjectNumber({ number: "{edit>/total_func}", unit: "h", state: "Information" }));
            formContent.push(new Label({ text: "TECH Total", design: "Bold" }));
            formContent.push(new ObjectNumber({ number: "{edit>/total_tech}", unit: "h", state: "Information" }));
            formContent.push(new Label({ text: "Grand Total", design: "Bold" }));
            formContent.push(new ObjectNumber({ number: "{edit>/grand_total}", unit: "h", state: "Success", emphasized: true }));

            var dialog = new Dialog({
                title: row.frice + " / " + row.classification + " — " + row.complexity,
                contentWidth: "36rem",
                verticalScrolling: true,
                content: new SimpleForm({
                    editable: true,
                    layout: "ResponsiveGridLayout",
                    columnsL: 1, columnsM: 1,
                    content: formContent
                }),
                beginButton: new Button({
                    text: "Save", type: "Emphasized",
                    press: function () {
                        var data = editModel.getData();
                        that.getOwnerComponent().api("PUT",
                            "/admin/estimation-grid/" + data.id, data
                        ).then(function () {
                            MessageToast.show("Saved");
                            dialog.close();
                            that._load();
                        });
                    }
                }),
                endButton: new Button({
                    text: "Cancel",
                    press: function () { dialog.close(); }
                }),
                afterClose: function () { dialog.destroy(); }
            });

            dialog.setModel(editModel, "edit");
            dialog.open();
        },

        _recalcTotals: function (model) {
            var d = model.getData();
            var funcTotal = (d.fs_bus_req || 0) + (d.fs_f_analysis || 0) + (d.fs_f_spec || 0) +
                            (d.fut_f_tcases || 0) + (d.fut_test_data || 0) + (d.fut_fut || 0) +
                            (d.dev_qa || 0);
            var techTotal = (d.dev_t_analysis || 0) + (d.dev_t_spec || 0) +
                            (d.dev_coding || 0) + (d.dev_tt_cases || 0) + (d.dev_ut || 0) +
                            (d.brk_fix || 0);
            var grand = funcTotal + techTotal;

            model.setProperty("/total_func", Math.round(funcTotal * 10) / 10);
            model.setProperty("/total_tech", Math.round(techTotal * 10) / 10);
            model.setProperty("/grand_total", Math.round(grand * 10) / 10);
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("admin");
        }
    });
});
